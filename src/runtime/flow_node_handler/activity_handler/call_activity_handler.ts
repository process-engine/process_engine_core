import {Logger} from 'loggerhythm';

import {InternalServerError, NotFoundError} from '@essential-projects/errors_ts';
import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {
  BpmnType,
  FlowNodeInstance,
  ICorrelationService,
  IProcessModelUseCases,
  Model,
  ProcessInstance,
  ProcessToken,
} from '@process-engine/persistence_api.contracts';

import {
  EndEventReachedMessage,
  IExecuteProcessService,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  IResumeProcessService,
  ProcessTerminatedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';

import {ActivityHandler} from './activity_handler';

export class CallActivityHandler extends ActivityHandler<Model.Activities.CallActivity> {

  private correlationService: ICorrelationService;
  private executeProcessService: IExecuteProcessService;
  private processModelUseCases: IProcessModelUseCases;
  private resumeProcessService: IResumeProcessService;

  constructor(
    correlationService: ICorrelationService,
    eventAggregator: IEventAggregator,
    executeProcessService: IExecuteProcessService,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    processModelUseCases: IProcessModelUseCases,
    resumeProcessService: IResumeProcessService,
    callActivityModel: Model.Activities.CallActivity,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, callActivityModel);
    this.correlationService = correlationService;
    this.executeProcessService = executeProcessService;
    this.processModelUseCases = processModelUseCases;
    this.resumeProcessService = resumeProcessService;
    this.logger = new Logger(`processengine:call_activity_handler:${callActivityModel.id}`);
  }

  private get callActivity(): Model.Activities.CallActivity {
    return this.flowNode;
  }

  protected async startExecution(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing CallActivity instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this.executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    try {
      // First we need to find out if the Subprocess was already started.
      const processInstances = await this.correlationService.getSubprocessesForProcessInstance(identity, flowNodeInstance.processInstanceId);

      const noSubprocessesFound = !(processInstances?.length > 0);

      const matchingSubprocess = noSubprocessesFound
        ? undefined
        : processInstances.find((entry: ProcessInstance): boolean => entry.processModelId === this.callActivity.calledReference);

      let callActivityResult: EndEventReachedMessage;

      this.publishActivityReachedNotification(identity, onSuspendToken);

      if (matchingSubprocess == undefined) {
        // Subprocess not yet started. We need to run the handler again.
        callActivityResult = await this.executeSubprocess(identity, processTokenFacade, onSuspendToken);
      } else {
        // Subprocess was already started. Resume it and wait for the result:
        callActivityResult = <EndEventReachedMessage> await this
          .resumeProcessService
          .resumeProcessInstanceById(identity, matchingSubprocess.processModelId, matchingSubprocess.processInstanceId);
      }

      onSuspendToken.payload = this.createResultTokenPayloadFromCallActivityResult(callActivityResult);

      await this.persistOnResume(onSuspendToken);

      processTokenFacade.addResultForFlowNode(this.callActivity.id, this.flowNodeInstanceId, callActivityResult);
      await this.persistOnExit(onSuspendToken);

      this.publishActivityFinishedNotification(identity, onSuspendToken);

      return processModelFacade.getNextFlowNodesFor(this.callActivity);
    } catch (error) {
      this.logger.error(error);

      onSuspendToken.payload = {
        error: error.message,
        additionalInformation: error.additionalInformation,
      };

      const terminationRegex = /terminated/i;
      const isTerminationMessage = terminationRegex.test(error.message);

      if (isTerminationMessage) {
        await this.persistOnTerminate(onSuspendToken);
        this.terminateProcessInstance(identity, onSuspendToken);
      } else {
        await this.persistOnError(onSuspendToken, error);
      }

      throw error;
    }
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    try {
      this.publishActivityReachedNotification(identity, token);

      await this.persistOnSuspend(token);

      const callActivityResult = await this.executeSubprocess(identity, processTokenFacade, token);

      token.payload = this.createResultTokenPayloadFromCallActivityResult(callActivityResult);

      await this.persistOnResume(token);
      processTokenFacade.addResultForFlowNode(this.callActivity.id, this.flowNodeInstanceId, token.payload);
      await this.persistOnExit(token);

      this.publishActivityFinishedNotification(identity, token);

      return processModelFacade.getNextFlowNodesFor(this.callActivity);
    } catch (error) {
      this.logger.error(error);

      token.payload = {
        error: error.message,
        additionalInformation: error.additionalInformation,
      };

      const terminationRegex = /terminated/i;
      const isTerminationMessage = terminationRegex.test(error.message);

      if (isTerminationMessage) {
        await this.persistOnTerminate(token);
        this.terminateProcessInstance(identity, token);
      } else {
        await this.persistOnError(token, error);
      }

      throw error;
    }
  }

  /**
   * Executes the Subprocess.
   *
   * @async
   * @param   identity           The users identity.
   * @param   startEventId       The StartEvent by which to start the Subprocess.
   * @param   processTokenFacade The Facade for accessing the current process' tokens.
   * @param   token              The current ProcessToken.
   * @returns                    The CallActivities result.
   */
  private async executeSubprocess(
    identity: IIdentity,
    processTokenFacade: IProcessTokenFacade,
    token: ProcessToken,
  ): Promise<EndEventReachedMessage> {

    const startEventId = await this.getAccessibleCallActivityStartEvent(identity);
    const initialPayload = this.getInitialPayload(processTokenFacade, token, identity);

    const correlationId = token.correlationId;
    const parentProcessInstanceId = token.processInstanceId;

    const payload = initialPayload ?? {};

    const processModelId = this.callActivity.calledReference;

    const result = await this
      .executeProcessService
      .startAndAwaitEndEvent(identity, processModelId, correlationId, startEventId, payload, parentProcessInstanceId);

    return result;
  }

  /**
   * Retrieves the first accessible StartEvent for the ProcessModel with the
   * given ID.
   *
   * @async
   * @param   identity The users identity.
   * @returns          The retrieved StartEvent.
   */
  private async getAccessibleCallActivityStartEvent(identity: IIdentity): Promise<string> {

    const processModel = await this.processModelUseCases.getProcessModelById(identity, this.callActivity.calledReference);

    const startEvents = processModel.flowNodes.filter((flowNode: Model.Base.FlowNode): boolean => flowNode.bpmnType === BpmnType.startEvent);

    const startEventToUse = this.callActivity.startEventId != undefined
      ? startEvents.find((startEvent): boolean => startEvent.id === this.callActivity.startEventId)
      : startEvents[0];

    if (!startEventToUse) {
      const error = new NotFoundError('The referenced ProcessModel has no matching StartEvent!');
      error.additionalInformation = {
        configuredStartEventId: this.callActivity.startEventId,
      };

      throw error;
    }

    return startEventToUse.id;
  }

  private getInitialPayload(processTokenFacade: IProcessTokenFacade, token: ProcessToken, identity: IIdentity): any {

    if (this.callActivity.payload == undefined) {
      return token.payload;
    }

    try {
      const tokenHistory = processTokenFacade.getOldTokenFormat();

      const evaluatePayloadFunction = new Function('token', 'identity', `return ${this.callActivity.payload}`);

      return evaluatePayloadFunction.call(tokenHistory, tokenHistory, identity);
    } catch (error) {
      const errorMessage = `CallActivity payload configuration '${this.callActivity.payload}' is invalid!`;
      this.logger.error(errorMessage);

      throw new InternalServerError(errorMessage);
    }
  }

  private createResultTokenPayloadFromCallActivityResult(result: EndEventReachedMessage): any {

    if (!result) {
      return {};
    }

    const callActivityToken = result.currentToken;

    const tokenPayloadIsFromNestedCallActivity = callActivityToken.result != undefined
                                              && callActivityToken.endEventName != undefined
                                              && callActivityToken.endEventId != undefined;

    // If the token ran through a nested CallActivity, its result will already be wrapped in an object.
    // If that is the case, we need to extract the result and ignore the rest.
    // Otherwise we would get a result structure like:
    // {
    //   result: {
    //     result: 'Hello',
    //     endEventId: 'NestedCallActivityEndEventId',
    //     endEventName: 'NestedCallActivityEndEventName',
    //   },
    //   endEventId: 'CallActivityEndEventId',
    //   endEventName: 'CallActivityEndEventName',
    // }
    if (tokenPayloadIsFromNestedCallActivity) {
      return {
        result: callActivityToken.result,
        endEventId: result.flowNodeId,
        endEventName: result.flowNodeName,
      };
    }

    return {
      result: result.currentToken,
      endEventId: result.flowNodeId,
      endEventName: result.flowNodeName,
    };
  }

  private terminateProcessInstance(identity: IIdentity, token: ProcessToken): void {

    const eventName = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const message = new ProcessTerminatedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.flowNode.id,
      this.flowNodeInstanceId,
      identity,
      token.payload,
    );
    // ProcessInstance specific notification
    this.eventAggregator.publish(eventName, message);
    // Global notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processTerminated, message);
  }

}
