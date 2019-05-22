import * as uuid from 'node-uuid';

import {BadRequestError, InternalServerError, NotFoundError} from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity, IIdentityService} from '@essential-projects/iam_contracts';

import {
  EndEventReachedMessage,
  IExecuteProcessService,
  IFlowNodeHandlerFactory,
  ProcessStartedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';
import {IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

import {ProcessInstanceStateHandlingFacade} from './facades/process_instance_state_handling_facade';
import {ProcessModelFacade} from './facades/process_model_facade';
import {ProcessTokenFacade} from './facades/process_token_facade';

import {IProcessInstanceConfig} from './facades/iprocess_instance_config';

export class ExecuteProcessService implements IExecuteProcessService {

  private readonly eventAggregator: IEventAggregator;
  private readonly flowNodeHandlerFactory: IFlowNodeHandlerFactory;
  private readonly identityService: IIdentityService;

  private readonly processInstanceStateHandlingFacade: ProcessInstanceStateHandlingFacade;
  private readonly processModelUseCases: IProcessModelUseCases;

  // This identity is used to enable the `ExecuteProcessService` to always get full ProcessModels.
  // It needs those in order to be able to correctly start a ProcessModel.
  private internalIdentity: IIdentity;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    identityService: IIdentityService,
    processInstanceStateHandlingFacade: ProcessInstanceStateHandlingFacade,
    processModelUseCases: IProcessModelUseCases,
  ) {
    this.eventAggregator = eventAggregator;
    this.flowNodeHandlerFactory = flowNodeHandlerFactory;
    this.identityService = identityService;
    this.processInstanceStateHandlingFacade = processInstanceStateHandlingFacade;
    this.processModelUseCases = processModelUseCases;
  }

  public async initialize(): Promise<void> {
    const dummyToken = 'ZHVtbXlfdG9rZW4=';
    this.internalIdentity = await this.identityService.getIdentity(dummyToken);
  }

  public async start(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
    startEventId?: string,
    initialPayload?: any,
    caller?: string,
  ): Promise<ProcessStartedMessage> {

    await this.validateStartRequest(identity, processModelId, startEventId);

    const processInstanceConfig =
      await this.createProcessInstanceConfig(identity, processModelId, correlationId, startEventId, initialPayload, caller);

    // This UseCase is designed to resolve immediately after the ProcessInstance
    // was started, so we must not await the execution here.
    this.executeProcess(identity, processInstanceConfig);

    return new ProcessStartedMessage(
      correlationId,
      processModelId,
      processInstanceConfig.processInstanceId,
      startEventId,
      // We don't yet know the StartEvent's instanceId, because it hasn't been created yet.
      undefined,
      identity,
      initialPayload,
    );
  }

  public async startAndAwaitEndEvent(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
    startEventId?: string,
    initialPayload?: any,
    caller?: string,
  ): Promise<EndEventReachedMessage> {
    await this.validateStartRequest(identity, processModelId, startEventId);

    return this.executeProcessInstanceAndWaitForEndEvent(identity, processModelId, correlationId, startEventId, initialPayload, caller);
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

    await this.validateStartRequest(identity, processModelId, startEventId, endEventId, true);

    return this.executeProcessInstanceAndWaitForEndEvent(identity, processModelId, correlationId, startEventId, initialPayload, caller, endEventId);
  }

  private async executeProcessInstanceAndWaitForEndEvent(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
    startEventId?: string,
    initialPayload?: any,
    caller?: string,
    endEventId?: string,
  ): Promise<EndEventReachedMessage> {

    return new Promise<EndEventReachedMessage>(async (resolve: Function, reject: Function): Promise<void> => {

      try {
        const processInstanceConfig =
          await this.createProcessInstanceConfig(identity, processModelId, correlationId, startEventId, initialPayload, caller);

        const processEndMessageName = eventAggregatorSettings.messagePaths.endEventReached
          .replace(eventAggregatorSettings.messageParams.correlationId, processInstanceConfig.correlationId)
          .replace(eventAggregatorSettings.messageParams.processModelId, processModelId);

        let eventSubscription: Subscription;

        const messageReceivedCallback = async (message: EndEventReachedMessage): Promise<void> => {
          const isAwaitedEndEvent = !endEventId || message.flowNodeId === endEventId;
          if (isAwaitedEndEvent) {
            this.eventAggregator.unsubscribe(eventSubscription);
            resolve(message);
          }
        };

        eventSubscription = this.eventAggregator.subscribe(processEndMessageName, messageReceivedCallback);

        await this.executeProcess(identity, processInstanceConfig);
      } catch (error) {
        // Errors from @essential-project and ErrorEndEvents are thrown as they are.
        // Everything else is thrown as an InternalServerError.
        const isPresetError = (error.errorCode || error.code) && error.name;
        if (isPresetError) {
          reject(error);
        } else {
          reject(new InternalServerError(error.message));
        }
      }
    });
  }

  private async validateStartRequest(
    requestingIdentity: IIdentity,
    processModelId: string,
    startEventId?: string,
    endEventId?: string,
    waitForEndEvent: boolean = false,
  ): Promise<void> {

    const processModel = await this.processModelUseCases.getProcessModelById(requestingIdentity, processModelId);

    if (!processModel.isExecutable) {
      throw new BadRequestError('The process model is not executable!');
    }

    const startEventParameterGiven = startEventId !== undefined;
    if (startEventParameterGiven) {
      const hasNoMatchingStartEvent = !processModel.flowNodes.some((flowNode: Model.Base.FlowNode): boolean => {
        return flowNode.id === startEventId;
      });

      if (hasNoMatchingStartEvent) {
        throw new NotFoundError(`StartEvent with ID '${startEventId}' not found!`);
      }
    } else {
      this.validateSingleStartEvent(processModel);
    }

    if (waitForEndEvent) {

      if (!endEventId) {
        throw new BadRequestError('Must provide an EndEventId, when using callback type \'CallbackOnEndEventReached\'!');
      }

      const hasNoMatchingEndEvent = !processModel.flowNodes.some((flowNode: Model.Base.FlowNode): boolean => {
        return flowNode.id === endEventId;
      });

      if (hasNoMatchingEndEvent) {
        throw new NotFoundError(`EndEvent with ID '${startEventId}' not found!`);
      }
    }
  }

  private validateSingleStartEvent(processModel: Model.Process): void {
    const processModelFacade = new ProcessModelFacade(processModel);
    const startEvents = processModelFacade.getStartEvents();

    const multipleStartEventsDefined = startEvents.length > 1;
    if (multipleStartEventsDefined) {
      const startEventIds = startEvents.map((currentStartEvent: Model.Events.StartEvent): string => {
        return currentStartEvent.id;
      });

      const errorMessage = 'The Process Model contains multiple StartEvents, but no initial StartEvent was defined.';
      const badRequestError = new BadRequestError(errorMessage);

      const additionalInfos = {
        message: 'The ProcessModel contains the following StartEvent',
        startEventIds: startEventIds,
      };

      badRequestError.additionalInformation = additionalInfos as any;

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
  private async createProcessInstanceConfig(
    identity: IIdentity,
    processModelId: string,
    correlationId: string,
    startEventId: string,
    payload: any,
    caller: string,
  ): Promise<IProcessInstanceConfig> {

    // We use the internal identity here to ensure the ProcessModel will be complete.
    const processModel = await this.processModelUseCases.getProcessModelById(this.internalIdentity, processModelId);

    const processModelFacade = new ProcessModelFacade(processModel);

    const startEventIdSpecified = startEventId !== undefined;

    const startEvent = startEventIdSpecified
      ? processModelFacade.getStartEventById(startEventId)
      : processModelFacade.getSingleStartEvent();

    const processInstanceId = uuid.v4();

    if (!correlationId) {
      correlationId = uuid.v4();
    }

    if (payload === undefined) {
      payload = {};
    }

    const processTokenFacade = new ProcessTokenFacade(processInstanceId, processModel.id, correlationId, identity);

    const processToken = processTokenFacade.createProcessToken(payload);
    processToken.caller = caller;
    processToken.payload = payload;

    const processInstanceConfig = {
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
  private async executeProcess(identity: IIdentity, processInstanceConfig: IProcessInstanceConfig): Promise<void> {

    try {
      const terminateEvent = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
        .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceConfig.processInstanceId);

      this.eventAggregator.subscribeOnce(terminateEvent, async (): Promise<void> => {
        await this.processInstanceStateHandlingFacade.terminateSubprocesses(identity, processInstanceConfig.processInstanceId);

        throw new InternalServerError('Process was terminated!');
      });

      await this.processInstanceStateHandlingFacade.saveCorrelation(identity, processInstanceConfig);

      const startEventHandler = await this.flowNodeHandlerFactory.create(processInstanceConfig.startEvent);

      // Because of the usage of Promise-Chains, we only need to run the StartEvent and wait for the ProcessInstance to run its course.
      await startEventHandler.execute(
        processInstanceConfig.processToken,
        processInstanceConfig.processTokenFacade,
        processInstanceConfig.processModelFacade,
        identity,
      );

      const allResults = await processInstanceConfig.processTokenFacade.getAllResults();
      const resultToken = allResults.pop();

      await this.processInstanceStateHandlingFacade.finishProcessInstanceInCorrelation(identity, processInstanceConfig, resultToken);
    } catch (error) {
      await this.processInstanceStateHandlingFacade.finishProcessInstanceInCorrelationWithError(identity, processInstanceConfig, error);

      throw error;
    }
  }

}
