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
import { Model, Runtime } from '@process-engine/process_engine_contracts';
import { IExecuteProcessService } from '../iexecute_process_service';
import { IExecutionContextFascade,
  IFlowNodeHandler, IFlowNodeHandlerFactory, IProcessModelFascade, IProcessTokenFascade, NextFlowNodeInfo, ProcessModelFascade } from './../../index';
import { FlowNodeHandler } from './index';

export class SubProcessHandler extends FlowNodeHandler<Model.Activities.SubProcess> {
  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory = undefined;

  constructor(flowNodeHandlerFactory: IFlowNodeHandlerFactory) {
    super();
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
  }

  private get flowNodeHandlerFactory(): IFlowNodeHandlerFactory {
    return this._flowNodeHandlerFactory;
  }

  protected async executeIntern(subProcessNode: Model.Activities.SubProcess,
                                processTokenFascade: IProcessTokenFascade,
                                processModelFascade: IProcessModelFascade,
                                executionContextFascade: IExecutionContextFascade): Promise<NextFlowNodeInfo> {

    const subProcessTokenFascade: IProcessTokenFascade = await processTokenFascade.getProcessTokenFascadeForParallelBranch();
    const subProcessModelFascade: IProcessModelFascade = processModelFascade.getSubProcessModelFascade(subProcessNode);
    const startEvent: Model.Events.StartEvent = subProcessModelFascade.getStartEvent();

    const initialTokenData: any = await processTokenFascade.getOldTokenFormat();
    subProcessTokenFascade.addResultForFlowNode(startEvent.id, initialTokenData.current);

    await this._executeFlowNode(startEvent, subProcessTokenFascade, subProcessModelFascade, executionContextFascade);

    const finalTokenData: any = await subProcessTokenFascade.getOldTokenFormat();
    processTokenFascade.addResultForFlowNode(subProcessNode.id, finalTokenData.current);

    const nextFlowNode: Model.Base.FlowNode = processModelFascade.getNextFlowNodeFor(subProcessNode);

    return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);
  }

  private async _executeFlowNode(flowNode: Model.Base.FlowNode,
                                 processTokenFascade: IProcessTokenFascade,
                                 processModelFascade: IProcessModelFascade,
                                 executionContextFascade: IExecutionContextFascade): Promise<void> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFascade);

    const nextFlowNodeInfo: NextFlowNodeInfo = await flowNodeHandler.execute(flowNode,
                                                    processTokenFascade,
                                                    processModelFascade,
                                                    executionContextFascade);

    if (nextFlowNodeInfo.flowNode !== null) {
    await this._executeFlowNode(nextFlowNodeInfo.flowNode, nextFlowNodeInfo.processTokenFascade, processModelFascade, executionContextFascade);
    }
  }

}
