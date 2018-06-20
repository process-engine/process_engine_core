import { ExecutionContext, IToPojoOptions } from '@essential-projects/core_contracts';
import { IInvoker } from '@essential-projects/invocation_contracts';
import { ConsumerContext, IConsumerApiService, ICorrelationResult, ProcessModel,
  ProcessStartRequestPayload, ProcessStartResponsePayload, StartCallbackType} from '@process-engine/consumer_api_contracts';
import { IExecuteProcessService, IExecutionContextFacade, IFlowNodeInstancePersistance, IProcessModelFacade,
  IProcessTokenFacade, Model, NextFlowNodeInfo, Runtime } from '@process-engine/process_engine_contracts';
import { FlowNodeHandler } from './index';

export class CallActivityHandler extends FlowNodeHandler<Model.Activities.CallActivity> {

  private _consumerApiService: IConsumerApiService;
  private _flowNodeInstancePersistance: IFlowNodeInstancePersistance = undefined;

  constructor(consumerApiService: IConsumerApiService, flowNodeInstancePersistance: IFlowNodeInstancePersistance) {
    super();

    this._consumerApiService = consumerApiService;
    this._flowNodeInstancePersistance = flowNodeInstancePersistance;
  }

  private get consumerApiService(): IConsumerApiService {
    return this._consumerApiService;
  }

  private get flowNodeInstancePersistance(): IFlowNodeInstancePersistance {
    return this._flowNodeInstancePersistance;
  }

  protected async executeInternally(callActivityNode: Model.Activities.CallActivity,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();

    await this.flowNodeInstancePersistance.persistOnEnter(token, callActivityNode.id, flowNodeInstanceId);

    const encryptedToken: string = await executionContextFacade.getIdentityToken();

    const consumerContext: ConsumerContext = {
      identity: encryptedToken,
    };

    const tokenData: any = await processTokenFacade.getOldTokenFormat();

    const processInstanceId: string = token.processInstanceId;
    const startEventKey: string = await this._getAccessibleStartEvent(consumerContext, callActivityNode.calledReference);
    const correlationId: string =
      await this._waitForSubProcessToFinishAndReturnCorrelationId(consumerContext, processInstanceId, startEventKey, callActivityNode, tokenData);
    const correlationResult: ICorrelationResult
      = await this._retrieveSubProcessResult(consumerContext, processModelFacade, callActivityNode, correlationId);

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(callActivityNode);

    await processTokenFacade.addResultForFlowNode(callActivityNode.id, correlationResult);
    await this.flowNodeInstancePersistance.persistOnExit(token, callActivityNode.id, flowNodeInstanceId);

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
                                                                 tokenData: any): Promise<string> {

    const startCallbackType: StartCallbackType = StartCallbackType.CallbackOnProcessInstanceFinished;

    const payload: ProcessStartRequestPayload = {
      // Setting this to undefined, will cause the Consumer API generate a Correlation ID (UUID).
      correlationId: undefined,
      callerId: processInstanceId,
      inputValues: tokenData.current || {},
    };

    const processKey: string = callActivityNode.calledReference;

    const result: ProcessStartResponsePayload =
      await this.consumerApiService.startProcessInstance(consumerContext, processKey, startEventKey, payload, startCallbackType);

    const correlationId: string = result.correlationId;

    return correlationId;
  }

  private async _retrieveSubProcessResult(consumerContext: ConsumerContext,
                                          processModelFacade: IProcessModelFacade,
                                          callActivityNode: Model.Activities.CallActivity,
                                          correlationId: string): Promise<ICorrelationResult> {

    const correlationResult: ICorrelationResult =
      await this.consumerApiService.getProcessResultForCorrelation(consumerContext, correlationId, callActivityNode.calledReference);

    return correlationResult;
  }
}
