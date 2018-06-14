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
import { IExecuteProcessService, IExecutionContextFacade, IFlowNodeHandler, IFlowNodeHandlerFactory, IProcessModelFacade, IProcessTokenFacade, Model,
  NextFlowNodeInfo} from '@process-engine/process_engine_contracts';
import { ProcessModelFacade } from './../../index';
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

  protected async executeInternally(subProcessNode: Model.Activities.SubProcess,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    // Create a child Facade for the ProcessToken, so that results of the Process are accessible by the SubProcess,
    // but results of the SubProcess are not accessible by the original Process before the SubProcess finishes.

    const subProcessTokenFacade: IProcessTokenFacade = await processTokenFacade.getProcessTokenFacadeForParallelBranch();

    // The regular ProcessModelFacade has a too broad scope of elements to query elements that only exist inside a SubProcess.
    // However, the SubProcess contains all its FlowNodes and SequencesFlows so that we can use that object to query against.

    // The SubProcess-specific Facade implements the same interface as the regular ProcessModelFacade so that we can pass it
    // through to handlers inside the SubProcess.

    const subProcessModelFacade: IProcessModelFacade = processModelFacade.getSubProcessModelFacade(subProcessNode);
    const startEvent: Model.Events.StartEvent = subProcessModelFacade.getStartEvent();

    // The initial token value is used as a result of the StartEvent inside the SubProcess
    const initialTokenData: any = await processTokenFacade.getOldTokenFormat();
    subProcessTokenFacade.addResultForFlowNode(startEvent.id, initialTokenData.current);

    await this._executeFlowNode(startEvent, subProcessTokenFacade, subProcessModelFacade, executionContextFacade);

    // After all FlowNodes in the SubProcess have been executed, set the last "current" token value as a result of the whole SubProcess
    // and on the original ProcessTokenFacade, so that is is accessible by the original Process

    const finalTokenData: any = await subProcessTokenFacade.getOldTokenFormat();
    processTokenFacade.addResultForFlowNode(subProcessNode.id, finalTokenData.current);

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(subProcessNode);

    return new NextFlowNodeInfo(nextFlowNode, processTokenFacade);
  }

  private async _executeFlowNode(flowNode: Model.Base.FlowNode,
                                 processTokenFacade: IProcessTokenFacade,
                                 processModelFacade: IProcessModelFacade,
                                 executionContextFacade: IExecutionContextFacade): Promise<void> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo = await flowNodeHandler.execute(flowNode,
                                                    processTokenFacade,
                                                    processModelFacade,
                                                    executionContextFacade);

    if (nextFlowNodeInfo.flowNode !== undefined) {
      await this._executeFlowNode(nextFlowNodeInfo.flowNode, nextFlowNodeInfo.processTokenFacade, processModelFacade, executionContextFacade);
    }
  }

}
