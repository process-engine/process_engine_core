
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
  IFlowNodeInstancePersistenceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class CallActivityHandler extends FlowNodeHandler<Model.Activities.CallActivity> {

  private _consumerApiService: IConsumerApiService;
  private _flowNodeInstancePersistenceService: IFlowNodeInstancePersistenceService = undefined;

  constructor(consumerApiService: IConsumerApiService, flowNodeInstancePersistenceService: IFlowNodeInstancePersistenceService) {
    super();

    this._consumerApiService = consumerApiService;
    this._flowNodeInstancePersistenceService = flowNodeInstancePersistenceService;
  }

  private get consumerApiService(): IConsumerApiService {
    return this._consumerApiService;
  }

  private get flowNodeInstancePersistenceService(): IFlowNodeInstancePersistenceService {
    return this._flowNodeInstancePersistenceService;
  }

  protected async executeInternally(callActivityNode: Model.Activities.CallActivity,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();

    await this.flowNodeInstancePersistenceService.persistOnEnter(executionContextFacade, token, callActivityNode.id, flowNodeInstanceId);

    const encryptedToken: string = await executionContextFacade.getIdentityToken();

    const consumerContext: ConsumerContext = {
      identity: encryptedToken,
    };

    const tokenData: any = await processTokenFacade.getOldTokenFormat();

    const processInstanceId: string = token.processInstanceId;
    const startEventKey: string = await this._getAccessibleStartEvent(consumerContext, callActivityNode.calledReference);

    const processStartResponse: ProcessStartResponsePayload =
      await this._waitForSubProcessToFinishAndReturnCorrelationId(consumerContext, processInstanceId, startEventKey, callActivityNode, tokenData);

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(callActivityNode);

    await processTokenFacade.addResultForFlowNode(callActivityNode.id, processStartResponse.tokenPayload);
    token.payload = processStartResponse.tokenPayload;

    await this.flowNodeInstancePersistenceService.persistOnExit(executionContextFacade, token, callActivityNode.id, flowNodeInstanceId);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }

  private async _getAccessibleStartEvent(consumerContext: ConsumerContext, processKey: string): Promise<string> {

    const processModel: ProcessModel = await this.consumerApiService.getProcessModelByKey(consumerContext, processKey);

    /*
     * Pick the first accessible start event;
     * note: If the user cannot access the process model and/or its start events,
     * the Consumer API will already have thrown an HTTP Unauthorized error,
     * so we do not need to handle those cases here.
     */
    const startEventKey: string = processModel.startEvents[0].key;

    return startEventKey;
  }

  private async _waitForSubProcessToFinishAndReturnCorrelationId(consumerContext: ConsumerContext,
                                                                 processInstanceId: string,
                                                                 startEventKey: string,
                                                                 callActivityNode: Model.Activities.CallActivity,
                                                                 tokenData: any): Promise<ProcessStartResponsePayload> {

    const startCallbackType: StartCallbackType = StartCallbackType.CallbackOnProcessInstanceFinished;

    const payload: ProcessStartRequestPayload = {
      // Setting this to undefined, will cause the Consumer API to generate a Correlation ID (UUID).
      correlationId: undefined,
      callerId: processInstanceId,
      inputValues: tokenData.current || {},
    };

    const processKey: string = callActivityNode.calledReference;

    const result: ProcessStartResponsePayload =
      await this.consumerApiService.startProcessInstance(consumerContext, processKey, startEventKey, payload, startCallbackType);

    return result;
  }
}
