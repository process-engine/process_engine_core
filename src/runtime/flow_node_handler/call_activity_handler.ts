import {Logger} from 'loggerhythm';

import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {DataModels as ConsumerApiTypes, IConsumerApi} from '@process-engine/consumer_api_contracts';
import {Correlation, CorrelationProcessInstance, ICorrelationService} from '@process-engine/correlation.contracts';
import {FlowNodeInstance, ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  IResumeProcessService,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {FlowNodeHandlerInterruptible} from './index';

export class CallActivityHandler extends FlowNodeHandlerInterruptible<Model.Activities.CallActivity> {

  private _consumerApiService: IConsumerApi;
  private _correlationService: ICorrelationService;
  private _resumeProcessService: IResumeProcessService;

  constructor(
    consumerApiService: IConsumerApi,
    correlationService: ICorrelationService,
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    resumeProcessService: IResumeProcessService,
    callActivityModel: Model.Activities.CallActivity,
    ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, callActivityModel);
    this._consumerApiService = consumerApiService;
    this._correlationService = correlationService;
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

    const noSubProcessesFound: boolean = correlation === undefined;

    const matchingSubProcess: CorrelationProcessInstance = noSubProcessesFound
      ? undefined
      : correlation.processModels.find((entry: CorrelationProcessInstance): boolean => {
          return entry.processModelId === this.callActivity.calledReference;
        });

    let callActivityResult: any;

    const callActivityNotYetExecuted: boolean = matchingSubProcess === undefined;
    if (callActivityNotYetExecuted) {
      // Subprocess not yet started. We need to run the handler again.
      const startEventId: string = await this._getAccessibleCallActivityStartEvent(identity);

      const processStartResponse: ConsumerApiTypes.ProcessModels.ProcessStartResponsePayload =
        await this._executeSubprocess(identity, startEventId, processTokenFacade, onSuspendToken);

      callActivityResult = processStartResponse.tokenPayload;
    } else {
      // Subprocess was already started. Resume it and wait for the result:
      callActivityResult =
        await this._resumeProcessService.resumeProcessInstanceById(identity, matchingSubProcess.processModelId, matchingSubProcess.processInstanceId);
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

    const processStartResponse: ConsumerApiTypes.ProcessModels.ProcessStartResponsePayload =
      await this._executeSubprocess(identity, startEventId, processTokenFacade, token);

    token.payload = processStartResponse.tokenPayload;

    await this.persistOnResume(token);
    processTokenFacade.addResultForFlowNode(this.callActivity.id, this.flowNodeInstanceId, processStartResponse.tokenPayload);
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

    const processModel: ConsumerApiTypes.ProcessModels.ProcessModel =
      await this._consumerApiService.getProcessModelById(identity, this.callActivity.calledReference);

    /*
     * Note: If the user cannot access the process model and/or its start events,
     * the Consumer API will already have thrown an HTTP Unauthorized error,
     * so we do not need to handle those cases here.
     */
    const startEventId: string = processModel.startEvents[0].id;

    return startEventId;
  }

  /**
   * Uses the ConsumerAPI to execute the ProcessModel defined in the
   * CallActivity FlowNode.
   *
   * @async
   * @param identity           The users identity.
   * @param startEventId       The StartEvent by which to start the SubProcess.
   * @param processTokenFacade The Facade for accessing the current process' tokens.
   * @param token              The current ProcessToken.
   */
  private async _executeSubprocess(
    identity: IIdentity,
    startEventId: string,
    processTokenFacade: IProcessTokenFacade,
    token: ProcessToken,
  ): Promise<ConsumerApiTypes.ProcessModels.ProcessStartResponsePayload> {

    const tokenData: any = processTokenFacade.getOldTokenFormat();

    const processInstanceId: string = token.processInstanceId;
    const correlationId: string = token.correlationId;

    const startCallbackType: ConsumerApiTypes.ProcessModels.StartCallbackType =
      ConsumerApiTypes.ProcessModels.StartCallbackType.CallbackOnProcessInstanceFinished;

    const payload: ConsumerApiTypes.ProcessModels.ProcessStartRequestPayload = {
      correlationId: correlationId,
      callerId: processInstanceId,
      inputValues: tokenData.current || {},
    };

    const processModelId: string = this.callActivity.calledReference;

    try {
      const result: ConsumerApiTypes.ProcessModels.ProcessStartResponsePayload =
        await this._consumerApiService.startProcessInstance(identity, processModelId, payload, startCallbackType, startEventId);

      return result;
    } catch (error) {
      this.logger.error(error);

      await this.persistOnError(token, error);

      throw error;
    }
  }
}
