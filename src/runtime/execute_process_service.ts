import * as uuid from 'node-uuid';

import {BadRequestError, InternalServerError, NotFoundError} from '@essential-projects/errors_ts';
import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity, IIdentityService} from '@essential-projects/iam_contracts';

import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  EndEventReachedMessage,
  eventAggregatorSettings,
  IExecuteProcessService,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceResult,
  IProcessModelFacade,
  IProcessTokenFacade,
  ProcessStartedMessage,
} from '@process-engine/process_engine_contracts';
import {IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

import {ProcessInstanceStateHandlingFacade} from './facades/process_instance_state_handling_facade';
import {ProcessModelFacade} from './facades/process_model_facade';
import {ProcessTokenFacade} from './facades/process_token_facade';

import {IProcessInstanceConfig} from './facades/iprocess_instance_config';

export class ExecuteProcessService implements IExecuteProcessService {

  private readonly _eventAggregator: IEventAggregator;
  private readonly _flowNodeHandlerFactory: IFlowNodeHandlerFactory;
  private readonly _identityService: IIdentityService;

  private readonly _processInstanceStateHandlingFacade: ProcessInstanceStateHandlingFacade;
  private readonly _processModelUseCases: IProcessModelUseCases;

  // This identity is used to enable the `ExecuteProcessService` to always get full ProcessModels.
  // It needs those in order to be able to correctly start a ProcessModel.
  private _internalIdentity: IIdentity;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    identityService: IIdentityService,
    processInstanceStateHandlingFacade: ProcessInstanceStateHandlingFacade,
    processModelUseCases: IProcessModelUseCases,
  ) {
    this._eventAggregator = eventAggregator;
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this._identityService = identityService;
    this._processInstanceStateHandlingFacade = processInstanceStateHandlingFacade;
    this._processModelUseCases = processModelUseCases;
  }

  public async initialize(): Promise<void> {
    const dummyToken: string = 'ZHVtbXlfdG9rZW4=';
    this._internalIdentity = await this._identityService.getIdentity(dummyToken);
  }

  public async start(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
    startEventId?: string,
    initialPayload?: any,
    caller?: string,
  ): Promise<ProcessStartedMessage> {

    await this._validateStartRequest(identity, processModelId, startEventId);

    const processInstanceConfig: IProcessInstanceConfig = await
      this._createProcessInstanceConfig(identity, processModelId, correlationId, startEventId, initialPayload, caller);

    // This UseCase is designed to resolve immediately after the ProcessInstance
    // was started, so we must not await the execution here.
    this._executeProcess(identity, processInstanceConfig);

    return new ProcessStartedMessage(correlationId,
                                     processModelId,
                                     processInstanceConfig.processInstanceId,
                                     startEventId,
                                     // We don't yet know the StartEvent's instanceId, because it hasn't been created yet.
                                     undefined,
                                     identity,
                                     initialPayload);
  }

  public async startAndAwaitEndEvent(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
    startEventId?: string,
    initialPayload?: any,
    caller?: string,
  ): Promise<EndEventReachedMessage> {
    await this._validateStartRequest(identity, processModelId, startEventId);

    return this._startAndAwaitEndEvent(identity, processModelId, correlationId, startEventId, initialPayload, caller);
  }

  public async startAndAwaitSpecificEndEvent(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
    endEventId: string,
    startEventId?: string,
    initialPayload?: any,
    caller?: string,
  ): Promise<EndEventReachedMessage> {

    await this._validateStartRequest(identity, processModelId, startEventId, endEventId, true);

    return this._startAndAwaitEndEvent(identity, processModelId, correlationId, startEventId, initialPayload, caller, endEventId);
  }

  private async _startAndAwaitEndEvent(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
    startEventId?: string,
    initialPayload?: any,
    caller?: string,
    endEventId?: string,
  ): Promise<EndEventReachedMessage> {

    return new Promise<EndEventReachedMessage>(async(resolve: Function, reject: Function): Promise<void> => {

      try {
        const processInstanceConfig: IProcessInstanceConfig = await
          this._createProcessInstanceConfig(identity, processModelId, correlationId, startEventId, initialPayload, caller);

        const processEndMessageName: string = eventAggregatorSettings.messagePaths.endEventReached
          .replace(eventAggregatorSettings.messageParams.correlationId, processInstanceConfig.correlationId)
          .replace(eventAggregatorSettings.messageParams.processModelId, processModelId);

        let eventSubscription: Subscription;

        const messageReceivedCallback: EventReceivedCallback = async(message: EndEventReachedMessage): Promise<void> => {
          const isAwaitedEndEvent: boolean = !endEventId || message.flowNodeId === endEventId;
          if (isAwaitedEndEvent) {
            this._eventAggregator.unsubscribe(eventSubscription);
            resolve(message);
          }
        };

        eventSubscription = this._eventAggregator.subscribe(processEndMessageName, messageReceivedCallback);

        await this._executeProcess(identity, processInstanceConfig);
      } catch (error) {
        // Errors from @essential-project and ErrorEndEvents are thrown as they are.
        // Everything else is thrown as an InternalServerError.
        const isPresetError: boolean = (error.errorCode || error.code) && error.name;
        if (isPresetError) {
          return reject(error);
        }

        reject(new InternalServerError(error.message));
      }
    });
  }

  private async _validateStartRequest(
    requestingIdentity: IIdentity,
    processModelId: string,
    startEventId?: string,
    endEventId?: string,
    waitForEndEvent: boolean = false,
  ): Promise<void> {

    const processModel: Model.Process = await this._processModelUseCases.getProcessModelById(requestingIdentity, processModelId);

    if (!processModel.isExecutable) {
      throw new BadRequestError('The process model is not executable!');
    }

    const startEventParameterGiven: boolean = startEventId !== undefined;
    if (startEventParameterGiven) {
      const hasNoMatchingStartEvent: boolean = !processModel.flowNodes.some((flowNode: Model.Base.FlowNode): boolean => {
        return flowNode.id === startEventId;
      });

      if (hasNoMatchingStartEvent) {
        throw new NotFoundError(`StartEvent with ID '${startEventId}' not found!`);
      }
    } else {
      this._validateSingleStartEvent(processModel);
    }

    if (waitForEndEvent) {

      if (!endEventId) {
        throw new BadRequestError(`Must provide an EndEventId, when using callback type 'CallbackOnEndEventReached'!`);
      }

      const hasNoMatchingEndEvent: boolean = !processModel.flowNodes.some((flowNode: Model.Base.FlowNode): boolean => {
        return flowNode.id === endEventId;
      });

      if (hasNoMatchingEndEvent) {
        throw new NotFoundError(`EndEvent with ID '${startEventId}' not found!`);
      }
    }
  }

  private _validateSingleStartEvent(processModel: Model.Process): void {
    const processModelFacade: IProcessModelFacade = new ProcessModelFacade(processModel);
    const startEvents: Array<Model.Events.StartEvent> = processModelFacade.getStartEvents();

    const multipleStartEventsDefined: boolean = startEvents.length > 1;
    if (multipleStartEventsDefined) {
      const startEventIds: Array<String> = startEvents.map((currentStartEvent: Model.Events.StartEvent) => {
        return currentStartEvent.id;
      });

      const errorMessage: string = 'The Process Model contains multiple StartEvents, but no initial StartEvent was defined.';
      const badRequestError: BadRequestError = new BadRequestError(errorMessage);

      const additionalInfos: any = {
        message: 'The ProcessModel contains the following StartEvent',
        startEventIds: startEventIds,
      };

      badRequestError.additionalInformation = additionalInfos;

      throw badRequestError;
    }
  }

  /**
   * Creates a Set of configurations for a new ProcessInstance.
   * Contains infos such as the CorrelationId and the ProcessInstanceId.
   *
   * @async
   * @param identity       The identity of the requesting user.
   * @param processModelId The ID of the ProcessModel for which a new
   *                       ProcessInstance is to be created.
   * @param correlationId  The CorrelationId in which the ProcessInstance
   *                       should run.
   *                       Will be generated, if not provided.
   * @param startEventId   The ID of the StartEvent by which to start the
   *                       ProcessInstance.
   * @param payload        The payload to pass to the ProcessInstance.
   * @param caller         If the ProcessInstance is a Subprocess or
   *                       CallActivity, this contains the ID of the calling
   *                       ProcessInstance.
   * @returns              A set of configurations for the new ProcessInstance.
   */
  private async _createProcessInstanceConfig(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
    startEventId: string,
    payload: any,
    caller: string,
  ): Promise<IProcessInstanceConfig> {

    // We use the internal identity here to ensure the ProcessModel will be complete.
    const processModel: Model.Process = await this._processModelUseCases.getProcessModelById(this._internalIdentity, processModelId);

    const processModelFacade: IProcessModelFacade = new ProcessModelFacade(processModel);

    const startEventIdSpecified: boolean = startEventId !== undefined;

    const startEvent: Model.Events.StartEvent = startEventIdSpecified
        ? processModelFacade.getStartEventById(startEventId)
        : processModelFacade.getSingleStartEvent();

    const processInstanceId: string = uuid.v4();

    if (!correlationId) {
      correlationId = uuid.v4();
    }

    if (payload === undefined || payload === null) {
      payload = {};
    }

    const processTokenFacade: IProcessTokenFacade = new ProcessTokenFacade(processInstanceId, processModel.id, correlationId, identity);

    const processToken: ProcessToken = processTokenFacade.createProcessToken(payload);
    processToken.caller = caller;
    processToken.payload = payload;

    const processInstanceConfig: IProcessInstanceConfig = {
      correlationId: correlationId,
      processModelId: processModel.id,
      processInstanceId: processInstanceId,
      parentProcessInstanceId: caller,
      processModelFacade: processModelFacade,
      startEvent: startEvent,
      processToken: processToken,
      processTokenFacade: processTokenFacade,
    };

    return processInstanceConfig;
  }

  /**
   * Handles the execution of a ProcessInstance and returns the End result.
   *
   * @async
   * @param   identity              The identity of the requesting user.
   * @param   processInstanceConfig The configs for the ProcessInstance.
   */
  private async _executeProcess(identity: IIdentity, processInstanceConfig: IProcessInstanceConfig): Promise<void> {

    try {
      const terminateEvent: string = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
        .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceConfig.processInstanceId);

      this._eventAggregator.subscribeOnce(terminateEvent, async() => {
        await this._processInstanceStateHandlingFacade.terminateSubprocesses(identity, processInstanceConfig.processInstanceId);

        throw new InternalServerError('Process was terminated!');
      });

      await this._processInstanceStateHandlingFacade.saveCorrelation(identity, processInstanceConfig);

      const startEventHandler: IFlowNodeHandler<Model.Base.FlowNode> =
        await this._flowNodeHandlerFactory.create(processInstanceConfig.startEvent);

      // Because of the usage of Promise-Chains, we only need to run the StartEvent and wait for the ProcessInstance to run its course.
      await startEventHandler.execute(
        processInstanceConfig.processToken,
        processInstanceConfig.processTokenFacade,
        processInstanceConfig.processModelFacade,
        identity,
      );

      const allResults: Array<IFlowNodeInstanceResult> = await processInstanceConfig.processTokenFacade.getAllResults();
      const resultToken: IFlowNodeInstanceResult = allResults.pop();

      await this._processInstanceStateHandlingFacade.finishProcessInstanceInCorrelation(identity, processInstanceConfig, resultToken);
    } catch (error) {
      await this._processInstanceStateHandlingFacade.finishProcessInstanceInCorrelationWithError(identity, processInstanceConfig, error);

      throw error;
    }
  }
}
