import { ExecutionContext, IToPojoOptions } from '@essential-projects/core_contracts';
import { IInvoker } from '@essential-projects/invocation_contracts';
import {
  ConsumerContext,
  IConsumerApiService,
  ICorrelationResult,
  ProcessModel,
  ProcessStartRequestPayload,
  ProcessStartResponsePayload,
  StartCallbackType,
} from '@process-engine/consumer_api_contracts';
// tslint:disable-next-line:max-line-length
import { IExecuteProcessService, IExecutionContextFascade, IProcessModelFascade, IProcessTokenFascade, Model, Runtime } from '@process-engine/process_engine_contracts';
import { NextFlowNodeInfo } from './../../index';
import { FlowNodeHandler } from './index';

export class CallActivityHandler extends FlowNodeHandler<Model.Activities.CallActivity> {
  private _consumerApiService: IConsumerApiService;

  constructor(consumerApiService: IConsumerApiService) {
    super();

    this._consumerApiService = consumerApiService;
  }

  private get consumerApiService(): IConsumerApiService {
    return this._consumerApiService;
  }

  protected async executeIntern(callActivityNode: Model.Activities.CallActivity,
                                processTokenFascade: IProcessTokenFascade,
                                processModelFascade: IProcessModelFascade,
                                executionContextFascade: IExecutionContextFascade): Promise<NextFlowNodeInfo> {

    const encryptedToken: string = await executionContextFascade.getIdentityToken();

    const consumerContext: ConsumerContext = {
      identity: encryptedToken,
    };

    const tokenData: any = await processTokenFascade.getOldTokenFormat();

    const startEventKey: string = await this._getAccessibleStartEvent(consumerContext, callActivityNode.calledReference);
    // tslint:disable-next-line:max-line-length
    const correlationId: string = await this._waitForSubProcessToFinishAndReturnCorrelationId(consumerContext, startEventKey, callActivityNode, tokenData);
    const correlationResult: ICorrelationResult = await this._retrieveSubProcessResult(consumerContext, callActivityNode, correlationId);

    await processTokenFascade.addResultForFlowNode(callActivityNode.id, correlationResult);

    const nextFlowNode: Model.Base.FlowNode = processModelFascade.getNextFlowNodeFor(callActivityNode);

    return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);
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
                                                                 startEventKey: string,
                                                                 callActivityNode: Model.Activities.CallActivity,
                                                                 tokenData: any): Promise<string> {

    const startCallbackType: StartCallbackType = StartCallbackType.CallbackOnEndEventReached;

    const payload: ProcessStartRequestPayload = {
      // Setting this to undefined, will cause the Consumer API generate a Correlation ID (UUID).
      correlation_id: undefined,
      callerId: callActivityNode.id,
      input_values: tokenData.current || {},
    };

    const processKey: string = callActivityNode.calledReference;

    const result: ProcessStartResponsePayload =
      await this.consumerApiService.startProcessInstance(consumerContext, processKey, startEventKey, payload, startCallbackType);

    const correlationId: string = result.correlation_id;

    return correlationId;
  }

  private async _retrieveSubProcessResult(consumerContext: ConsumerContext,
                                          callActivityNode: Model.Activities.CallActivity,
                                          correlationId: string): Promise<ICorrelationResult> {

    const correlationResult: ICorrelationResult =
      await this.consumerApiService.getProcessResultForCorrelation(consumerContext, correlationId, callActivityNode.calledReference);

    return correlationResult;
  }
}
