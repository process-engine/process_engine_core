
import {
  ConsumerContext,
  IConsumerApiService,
  ProcessModel,
  ProcessStartRequestPayload,
  ProcessStartResponsePayload,
  StartCallbackType,
} from '@process-engine/consumer_api_contracts';
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

  private _consumerApiService: IConsumerApiService;
  private _flowNodeInstanceService: IFlowNodeInstanceService = undefined;

  constructor(consumerApiService: IConsumerApiService, flowNodeInstanceService: IFlowNodeInstanceService) {
    super();

    this._consumerApiService = consumerApiService;
    this._flowNodeInstanceService = flowNodeInstanceService;
  }

  private get consumerApiService(): IConsumerApiService {
    return this._consumerApiService;
  }

  private get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
  }

  protected async executeInternally(flowNodeInfo: NextFlowNodeInfo<Model.Activities.CallActivity>,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo<any>> {

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();
    const flowNode: Model.Activities.CallActivity = flowNodeInfo.flowNode;

    await this.flowNodeInstanceService.persistOnEnter(executionContextFacade, token, flowNode.id, flowNodeInstanceId);

    const identity: IIdentity = await executionContextFacade.getIdentity();

    const consumerContext: ConsumerContext = {
      identity: identity.token,
    };

    const tokenData: any = await processTokenFacade.getOldTokenFormat();

    const processInstanceId: string = token.processInstanceId;
    const startEventId: string = await this._getAccessibleStartEvent(consumerContext, flowNode.calledReference);

    const processStartResponse: ProcessStartResponsePayload =
      await this._waitForSubProcessToFinishAndReturnCorrelationId(consumerContext, processInstanceId, startEventId, flowNode, tokenData);

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(flowNode);

    await processTokenFacade.addResultForFlowNode(flowNode.id, processStartResponse.tokenPayload);
    token.payload = processStartResponse.tokenPayload;

    await this.flowNodeInstanceService.persistOnExit(executionContextFacade, token, flowNode.id, flowNodeInstanceId);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }

  private async _getAccessibleStartEvent(consumerContext: ConsumerContext, processModelId: string): Promise<string> {

    const processModel: ProcessModel = await this.consumerApiService.getProcessModelById(consumerContext, processModelId);

    /*
     * Pick the first accessible start event;
     * note: If the user cannot access the process model and/or its start events,
     * the Consumer API will already have thrown an HTTP Unauthorized error,
     * so we do not need to handle those cases here.
     */
    const startEventId: string = processModel.startEvents[0].id;

    return startEventId;
  }

  private async _waitForSubProcessToFinishAndReturnCorrelationId(consumerContext: ConsumerContext,
                                                                 processInstanceId: string,
                                                                 startEventId: string,
                                                                 callActivityNode: Model.Activities.CallActivity,
                                                                 tokenData: any): Promise<ProcessStartResponsePayload> {

    const startCallbackType: StartCallbackType = StartCallbackType.CallbackOnProcessInstanceFinished;

    const payload: ProcessStartRequestPayload = {
      // Setting this to undefined, will cause the Consumer API to generate a Correlation ID (UUID).
      correlationId: undefined,
      callerId: processInstanceId,
      inputValues: tokenData.current || {},
    };

    const processModelId: string = callActivityNode.calledReference;

    const result: ProcessStartResponsePayload =
      await this.consumerApiService.startProcessInstance(consumerContext, processModelId, startEventId, payload, startCallbackType);

    return result;
  }
}
