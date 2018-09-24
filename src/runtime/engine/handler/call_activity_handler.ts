
import {
  IConsumerApi,
  ProcessModel,
  ProcessStartRequestPayload,
  ProcessStartResponsePayload,
  StartCallbackType,
} from '@process-engine/consumer_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  IExecutionContextFacade,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeHandler} from './index';

export class CallActivityHandler extends FlowNodeHandler<Model.Activities.CallActivity> {

  private _consumerApiService: IConsumerApi;

  constructor(consumerApiService: IConsumerApi, flowNodeInstanceService: IFlowNodeInstanceService, metricsService: IMetricsApi) {
    super(flowNodeInstanceService, metricsService);

    this._consumerApiService = consumerApiService;
  }

  private get consumerApiService(): IConsumerApi {
    return this._consumerApiService;
  }

  protected async executeInternally(callActivity: Model.Activities.CallActivity,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(callActivity, token);

    const identity: IIdentity = await executionContextFacade.getIdentity();

    const tokenData: any = await processTokenFacade.getOldTokenFormat();

    const processInstanceId: string = token.processInstanceId;
    const correlationId: string = token.correlationId;
    const startEventId: string = await this._getAccessibleStartEvent(identity, callActivity.calledReference);

    await this.persistOnSuspend(callActivity, token);

    const processStartResponse: ProcessStartResponsePayload =
      await this._waitForSubProcessToFinishAndReturnCorrelationId(identity,
                                                                  correlationId,
                                                                  processInstanceId,
                                                                  startEventId,
                                                                  callActivity,
                                                                  tokenData);

    await this.persistOnResume(callActivity, token);

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(callActivity);

    await processTokenFacade.addResultForFlowNode(callActivity.id, processStartResponse.tokenPayload);
    token.payload = processStartResponse.tokenPayload;

    await this.persistOnExit(callActivity, token);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }

  /**
   * Retrieves the first accessible StartEvent for the ProcessModel with the
   * given ID.
   *
   * @async
   * @param   identity       The users identity.
   * @param   processModelId The ID of the ProcesssModel for which to get an
   *                         accessible StartEvent.
   * @returns                The retrieved StartEvent.
   */
  private async _getAccessibleStartEvent(identity: IIdentity, processModelId: string): Promise<string> {

    const processModel: ProcessModel = await this.consumerApiService.getProcessModelById(identity, processModelId);

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
   * @param callActivity      The CallActivity, containing the infos about the
   *                          SubProcess to start.
   * @param tokenData         The current ProcessToken.
   */
  private async _waitForSubProcessToFinishAndReturnCorrelationId(identity: IIdentity,
                                                                 correlationId: string,
                                                                 processInstanceId: string,
                                                                 startEventId: string,
                                                                 callActivity: Model.Activities.CallActivity,
                                                                 tokenData: any): Promise<ProcessStartResponsePayload> {

    const startCallbackType: StartCallbackType = StartCallbackType.CallbackOnProcessInstanceFinished;

    const payload: ProcessStartRequestPayload = {
      correlationId: correlationId,
      callerId: processInstanceId,
      inputValues: tokenData.current || {},
    };

    const processModelId: string = callActivity.calledReference;

    const result: ProcessStartResponsePayload =
      await this.consumerApiService.startProcessInstance(identity, processModelId, startEventId, payload, startCallbackType);

    return result;
  }
}
