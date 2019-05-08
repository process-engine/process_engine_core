import {Logger} from 'loggerhythm';

import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {CorrelationProcessInstance, ICorrelationService} from '@process-engine/correlation.contracts';
import {FlowNodeInstance, ProcessToken} from '@process-engine/flow_node_instance.contracts';
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
import {BpmnType, IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

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
    return super.flowNode;
  }

  protected async executeInternally(
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
      const correlation = await this.correlationService.getSubprocessesForProcessInstance(identity, flowNodeInstance.processInstanceId);

      const noSubprocessesFound = correlation === undefined;

      const matchingSubprocess = noSubprocessesFound ? undefined : correlation
        .processInstances
        .find((entry: CorrelationProcessInstance): boolean => entry.processModelId === this.callActivity.calledReference);

      let callActivityResult: EndEventReachedMessage;

      const callActivityNotYetExecuted = matchingSubprocess === undefined;
      if (callActivityNotYetExecuted) {
        // Subprocess not yet started. We need to run the handler again.
        const startEventId = await this.getAccessibleCallActivityStartEvent(identity);

        callActivityResult = await this.executeSubprocess(identity, startEventId, processTokenFacade, onSuspendToken);
      } else {
        // Subprocess was already started. Resume it and wait for the result:
        callActivityResult = await this
          .resumeProcessService
          .resumeProcessInstanceById(identity, matchingSubprocess.processModelId, matchingSubprocess.processInstanceId);
      }

      onSuspendToken.payload = this.createResultTokenPayloadFromCallActivityResult(callActivityResult);

      await this.persistOnResume(onSuspendToken);
      processTokenFacade.addResultForFlowNode(this.callActivity.id, this.flowNodeInstanceId, callActivityResult);
      await this.persistOnExit(onSuspendToken);

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
      const startEventId = await this.getAccessibleCallActivityStartEvent(identity);

      await this.persistOnSuspend(token);

      const callActivityResult = await this.executeSubprocess(identity, startEventId, processTokenFacade, token);

      token.payload = this.createResultTokenPayloadFromCallActivityResult(callActivityResult);

      await this.persistOnResume(token);
      processTokenFacade.addResultForFlowNode(this.callActivity.id, this.flowNodeInstanceId, token.payload);
      await this.persistOnExit(token);

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
   * Retrieves the first accessible StartEvent for the ProcessModel with the
   * given ID.
   *
   * @async
   * @param   identity The users identity.
   * @returns          The retrieved StartEvent.
   */
  private async getAccessibleCallActivityStartEvent(identity: IIdentity): Promise<string> {

    const processModel = await this.processModelUseCases.getProcessModelById(identity, this.callActivity.calledReference);

    /*
     * Since we cannot specify StartEventIds with a CallActivity, we just pick the first available StartEvent we find.
     *
     * Note: If the user cannot access the process model and/or its StartEvents,
     * the ProcessModelService will already have thrown an Unauthorized error,
     * so we do not need to handle those cases here.
     */
    const startEvent = processModel.flowNodes.find((flowNode: Model.Base.FlowNode): boolean => flowNode.bpmnType === BpmnType.startEvent);

    return startEvent.id;
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
    startEventId: string,
    processTokenFacade: IProcessTokenFacade,
    token: ProcessToken,
  ): Promise<EndEventReachedMessage> {

    const tokenData = processTokenFacade.getOldTokenFormat();

    const processInstanceId = token.processInstanceId;
    const correlationId = token.correlationId;

    const payload = tokenData.current || {};

    const processModelId = this.callActivity.calledReference;

    const result = await this
      .executeProcessService
      .startAndAwaitEndEvent(identity, processModelId, correlationId, startEventId, payload, processInstanceId);

    return result;
  }

  private createResultTokenPayloadFromCallActivityResult(result: EndEventReachedMessage): any {

    const callActivityToken = result.currentToken;

    const tokenPayloadIsFromNestedCallActivity = callActivityToken.result !== undefined
                                              && callActivityToken.endEventName !== undefined
                                              && callActivityToken.endEventId !== undefined;

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

    const eventName: string = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
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
