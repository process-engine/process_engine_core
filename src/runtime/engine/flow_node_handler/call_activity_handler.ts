
import {IIdentity} from '@essential-projects/iam_contracts';

import {
  IConsumerApi,
  ProcessModel,
  ProcessStartRequestPayload,
  ProcessStartResponsePayload,
  StartCallbackType,
} from '@process-engine/consumer_api_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class CallActivityHandler extends FlowNodeHandler<Model.Activities.CallActivity> {

  private _consumerApiService: IConsumerApi;

  constructor(consumerApiService: IConsumerApi,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              callActivityModel: Model.Activities.CallActivity) {
    super(flowNodeInstanceService, loggingApiService, metricsService, callActivityModel);

    this._consumerApiService = consumerApiService;
  }

  private get callActivity(): Model.Activities.CallActivity {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);

    const tokenData: any = await processTokenFacade.getOldTokenFormat();

    const processInstanceId: string = token.processInstanceId;
    const correlationId: string = token.correlationId;
    const startEventId: string = await this._getAccessibleCallActivityStartEvent(identity);

    await this.persistOnSuspend(token);

    const processStartResponse: ProcessStartResponsePayload =
      await this._waitForSubProcessToFinishAndReturnCorrelationId(identity,
                                                                  correlationId,
                                                                  processInstanceId,
                                                                  startEventId,
                                                                  tokenData);

    await this.persistOnResume(token);

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.callActivity);

    await processTokenFacade.addResultForFlowNode(this.callActivity.id, processStartResponse.tokenPayload);
    token.payload = processStartResponse.tokenPayload;

    await this.persistOnExit(token);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }

  public async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                identity: IIdentity,
                              ): Promise<NextFlowNodeInfo> {

    throw new Error('Not implemented yet.');
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

    const processModel: ProcessModel = await this._consumerApiService.getProcessModelById(identity, this.callActivity.calledReference);

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
   * @param identity          The users identity.
   * @param correlationId     The ID of the Correlation in which to run the
   *                          SubProcess specified in the CallActivtiy.
   * @param processInstanceId The ID of the current ProcessInstance.
   * @param startEventId      The StartEvent by which to start the SubProcess.
   * @param tokenData         The current ProcessToken.
   */
  private async _waitForSubProcessToFinishAndReturnCorrelationId(identity: IIdentity,
                                                                 correlationId: string,
                                                                 processInstanceId: string,
                                                                 startEventId: string,
                                                                 tokenData: any): Promise<ProcessStartResponsePayload> {

    const startCallbackType: StartCallbackType = StartCallbackType.CallbackOnProcessInstanceFinished;

    const payload: ProcessStartRequestPayload = {
      correlationId: correlationId,
      callerId: processInstanceId,
      inputValues: tokenData.current || {},
    };

    const processModelId: string = this.callActivity.calledReference;

    const result: ProcessStartResponsePayload =
      await this._consumerApiService.startProcessInstance(identity, processModelId, startEventId, payload, startCallbackType);

    return result;
  }
}
