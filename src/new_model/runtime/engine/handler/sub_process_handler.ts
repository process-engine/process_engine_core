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
import { IExecuteProcessService, IExecutionContextFascade, IFlowNodeHandler, IFlowNodeHandlerFactory, IProcessModelFascade, IProcessTokenFascade, Model,
  NextFlowNodeInfo} from '@process-engine/process_engine_contracts';
import { ProcessModelFascade } from './../../index';
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

    // Create a child fascade for the ProcessToken, so that results of the Process are accessible by the SubProcess,
    // but results of the SubProcess are not accessible by the original Process before the SubProcess finishes.

    const subProcessTokenFascade: IProcessTokenFascade = await processTokenFascade.getProcessTokenFascadeForParallelBranch();

    // The regular ProcessModelFascade has a too broad scope of elements to query elements that only exist inside a SubProcess.
    // However, the SubProcess contains all its FlowNodes and SequencesFlows so that we can use that object to query against.

    // The SubProcess-specific fascade implements the same interface as the regular ProcessModelFascade so that we can pass it
    // through to handlers inside the SubProcess.

    const subProcessModelFascade: IProcessModelFascade = processModelFascade.getSubProcessModelFascade(subProcessNode);
    const startEvent: Model.Events.StartEvent = subProcessModelFascade.getStartEvent();

    // The initial token value is used as a result of the StartEvent inside the SubProcess
    const initialTokenData: any = await processTokenFascade.getOldTokenFormat();
    subProcessTokenFascade.addResultForFlowNode(startEvent.id, initialTokenData.current);

    await this._executeFlowNode(startEvent, subProcessTokenFascade, subProcessModelFascade, executionContextFascade);

    // After all FlowNodes in the SubProcess have been executed, set the last "current" token value as a result of the whole SubProcess
    // and on the original ProcessTokenFascade, so that is is accessible by the original Process

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

    if (nextFlowNodeInfo.flowNode) {
      await this._executeFlowNode(nextFlowNodeInfo.flowNode, nextFlowNodeInfo.processTokenFascade, processModelFascade, executionContextFascade);
    }
  }

}
