import * as uuid from 'node-uuid';

import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
  isEssentialProjectsError,
} from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity, IIdentityService} from '@essential-projects/iam_contracts';

import {IProcessModelUseCases, Model} from '@process-engine/persistence_api.contracts';
import {
  BpmnError,
  EndEventReachedMessage,
  IExecuteProcessService,
  IFlowNodeHandlerFactory,
  ProcessStartedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';

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
    const internalToken = 'UHJvY2Vzc0VuZ2luZUludGVybmFsVXNlcg==';
    this.internalIdentity = await this.identityService.getIdentity(internalToken);
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

    try {
      const processInstanceConfig =
        await this.createProcessInstanceConfig(identity, processModelId, correlationId, startEventId, initialPayload, caller);

      const executionPromise = this.executeProcess(identity, processInstanceConfig);
      const eventSubscriptionPromise = this.awaitEndEvent(processInstanceConfig, endEventId);

      const results = await Promise.all([
        executionPromise,
        eventSubscriptionPromise,
      ]);

      return results[1];
    } catch (error) {
      // Errors from @essential-project and ErrorEndEvents are thrown as they are.
      // Everything else is thrown as an InternalServerError.
      const isPresetError = isEssentialProjectsError(error) || error instanceof BpmnError;
      if (isPresetError) {
        throw error;
      }
      throw new InternalServerError(error.message);
    }
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

    if (startEventId != undefined) {
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

    if (startEvents.length > 1) {
      const startEventIds = startEvents.map((currentStartEvent: Model.Events.StartEvent): string => currentStartEvent.id);

      const badRequestError = new BadRequestError('The Process Model contains multiple StartEvents, but no initial StartEvent was defined.');
      badRequestError.additionalInformation = {
        message: 'The ProcessModel contains the following StartEvent',
        startEventIds: startEventIds,
      };

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

    const startEvent = startEventId != undefined
      ? processModelFacade.getStartEventById(startEventId)
      : processModelFacade.getSingleStartEvent();

    const processInstanceId = uuid.v4();

    if (!correlationId) {
      correlationId = uuid.v4();
    }

    const processTokenFacade = new ProcessTokenFacade(processInstanceId, processModel.id, correlationId, identity);

    const processToken = processTokenFacade.createProcessToken(payload ?? {});
    processToken.caller = caller;

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
      await this.processInstanceStateHandlingFacade.saveProcessInstance(identity, processInstanceConfig);

      const startEventHandler = await this.flowNodeHandlerFactory.create(processInstanceConfig.startEvent);

      // Because of the usage of Promise-Chains, we only need to run the StartEvent and wait for the ProcessInstance to run its course.
      await startEventHandler.execute(
        processInstanceConfig.processToken,
        processInstanceConfig.processTokenFacade,
        processInstanceConfig.processModelFacade,
        identity,
      );

      const allResults = processInstanceConfig.processTokenFacade.getAllResults();
      const resultToken = allResults.pop();

      await this.processInstanceStateHandlingFacade.finishProcessInstance(identity, processInstanceConfig, resultToken);
    } catch (error) {
      await this.processInstanceStateHandlingFacade.finishProcessInstanceWithError(identity, processInstanceConfig, error);

      throw error;
    }
  }

  private async awaitEndEvent(processInstanceConfig: IProcessInstanceConfig, endEventId: string): Promise<EndEventReachedMessage> {

    return new Promise<EndEventReachedMessage>((resolve) => {
      const processEndMessageName = eventAggregatorSettings.messagePaths.endEventReached
        .replace(eventAggregatorSettings.messageParams.correlationId, processInstanceConfig.correlationId)
        .replace(eventAggregatorSettings.messageParams.processModelId, processInstanceConfig.processModelId);

      const subscription = this
        .eventAggregator
        .subscribe(processEndMessageName, (message: EndEventReachedMessage): void => {

          const isAwaitedEndEvent = !endEventId || message.flowNodeId === endEventId;
          if (isAwaitedEndEvent) {
            this.eventAggregator.unsubscribe(subscription);
            resolve(message);
          }
        });
    });
  }

}
