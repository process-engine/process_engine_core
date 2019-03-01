import {Logger} from 'loggerhythm';

import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {Correlation, CorrelationProcessInstance, ICorrelationService} from '@process-engine/correlation.contracts';
import {FlowNodeInstance, ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  EndEventReachedMessage,
  IExecuteProcessService,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  IResumeProcessService,
} from '@process-engine/process_engine_contracts';
import {BpmnType, IProcessModelUseCases, Model} from '@process-engine/process_model.contracts';

import {FlowNodeHandlerInterruptible} from './index';

export class CallActivityHandler extends FlowNodeHandlerInterruptible<Model.Activities.CallActivity> {

  private _correlationService: ICorrelationService;
  private _executeProcessService: IExecuteProcessService;
  private _processModelUseCases: IProcessModelUseCases;
  private _resumeProcessService: IResumeProcessService;

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
    this._correlationService = correlationService;
    this._executeProcessService = executeProcessService;
    this._processModelUseCases = processModelUseCases;
    this._resumeProcessService = resumeProcessService;
    this.logger = new Logger(`processengine:call_activity_handler:${callActivityModel.id}`);
  }

  private get callActivity(): Model.Activities.CallActivity {
    return super.flowNode;
  }

  // TODO: We can't interrupt a Subprocess yet, so this will remain inactive.
  public interrupt(token: ProcessToken, terminate?: boolean): Promise<void> {
    return Promise.resolve();
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing CallActivity instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    // First we need to find out if the Subprocess was already started.
    const correlation: Correlation
      = await this._correlationService.getSubprocessesForProcessInstance(identity, flowNodeInstance.processInstanceId);

    const noSubprocessesFound: boolean = correlation === undefined;

    const matchingSubprocess: CorrelationProcessInstance = noSubprocessesFound
      ? undefined
      : correlation.processModels.find((entry: CorrelationProcessInstance): boolean => {
          return entry.processModelId === this.callActivity.calledReference;
        });

    let callActivityResult: any;

    const callActivityNotYetExecuted: boolean = matchingSubprocess === undefined;
    if (callActivityNotYetExecuted) {
      // Subprocess not yet started. We need to run the handler again.
      const startEventId: string = await this._getAccessibleCallActivityStartEvent(identity);

      const processStartResponse: EndEventReachedMessage =
        await this._executeSubprocess(identity, startEventId, processTokenFacade, onSuspendToken);

      callActivityResult = processStartResponse.currentToken;
    } else {
      // Subprocess was already started. Resume it and wait for the result:
      callActivityResult =
        await this._resumeProcessService.resumeProcessInstanceById(identity, matchingSubprocess.processModelId, matchingSubprocess.processInstanceId);
    }

    onSuspendToken.payload = callActivityResult;
    await this.persistOnResume(onSuspendToken);
    processTokenFacade.addResultForFlowNode(this.callActivity.id, this.flowNodeInstanceId, callActivityResult);
    await this.persistOnExit(onSuspendToken);

    return processModelFacade.getNextFlowNodesFor(this.callActivity);
  }

  protected async _executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const startEventId: string = await this._getAccessibleCallActivityStartEvent(identity);

    await this.persistOnSuspend(token);

    const result: EndEventReachedMessage =
      await this._executeSubprocess(identity, startEventId, processTokenFacade, token);

    token.payload = result.currentToken;

    await this.persistOnResume(token);
    processTokenFacade.addResultForFlowNode(this.callActivity.id, this.flowNodeInstanceId, result.currentToken);
    await this.persistOnExit(token);

    return processModelFacade.getNextFlowNodesFor(this.callActivity);
  }

  /**
   * Retrieves the first accessible StartEvent for the ProcessModel with the
   * given ID.
   *
   * @async
   * @param   identity The users identity.
   * @returns          The retrieved StartEvent.
   */
  private async _getAccessibleCallActivityStartEvent(identity: IIdentity): Promise<string> {

    const processModel: Model.Process =
      await this._processModelUseCases.getProcessModelById(identity, this.callActivity.calledReference);

    /*
     * Since we cannot specify StartEventIds with a CallActivity, we just pick the first available StartEvent we find.
     *
     * Note: If the user cannot access the process model and/or its StartEvents,
     * the ProcessModelService will already have thrown an Unauthorized error,
     * so we do not need to handle those cases here.
     */
    const startEvent: Model.Base.FlowNode =
      processModel.flowNodes.find((flowNode: Model.Base.FlowNode) => flowNode.bpmnType === BpmnType.startEvent);

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
  private async _executeSubprocess(
    identity: IIdentity,
    startEventId: string,
    processTokenFacade: IProcessTokenFacade,
    token: ProcessToken,
  ): Promise<EndEventReachedMessage> {

    const tokenData: any = processTokenFacade.getOldTokenFormat();

    const processInstanceId: string = token.processInstanceId;
    const correlationId: string = token.correlationId;

    const payload: any = tokenData.current || {};

    const processModelId: string = this.callActivity.calledReference;

    try {
      const result: EndEventReachedMessage =
        await this._executeProcessService.startAndAwaitEndEvent(identity, processModelId, correlationId, startEventId, payload, processInstanceId);

      return result;
    } catch (error) {
      this.logger.error(error);

      await this.persistOnError(token, error);

      throw error;
    }
  }
}
