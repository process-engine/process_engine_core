import {
  IExecutionContextFacade,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class SubProcessHandler extends FlowNodeHandler<Model.Activities.SubProcess> {

  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory = undefined;
  private _flowNodeInstanceService: IFlowNodeInstanceService = undefined;

  constructor(flowNodeHandlerFactory: IFlowNodeHandlerFactory, flowNodeInstanceService: IFlowNodeInstanceService) {
    super();
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this._flowNodeInstanceService = flowNodeInstanceService;
  }

  private get flowNodeHandlerFactory(): IFlowNodeHandlerFactory {
    return this._flowNodeHandlerFactory;
  }

  private get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
  }

  protected async executeInternally(flowNodeInfo: NextFlowNodeInfo<Model.Activities.SubProcess>,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo<Model.Base.FlowNode>> {

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();
    const flowNode: Model.Activities.SubProcess = flowNodeInfo.flowNode;

    await this.flowNodeInstanceService.persistOnEnter(executionContextFacade, token, flowNode.id, flowNodeInstanceId);

    // Create a child Facade for the ProcessToken, so that results of the Process are accessible by the SubProcess,
    // but results of the SubProcess are not accessible by the original Process before the SubProcess finishes.

    const subProcessTokenFacade: IProcessTokenFacade = await processTokenFacade.getProcessTokenFacadeForParallelBranch();

    // The regular ProcessModelFacade has a too broad scope of elements to query elements that only exist inside a SubProcess.
    // However, the SubProcess contains all its FlowNodes and SequencesFlows so that we can use that object to query against.

    // The SubProcess-specific Facade implements the same interface as the regular ProcessModelFacade so that we can pass it
    // through to handlers inside the SubProcess.

    const subProcessModelFacade: IProcessModelFacade = processModelFacade.getSubProcessModelFacade(flowNode);
    const startEvents: Array<Model.Events.StartEvent> = subProcessModelFacade.getStartEvents();
    const startEvent: Model.Events.StartEvent = startEvents[0];

    // The initial token value is used as a result of the StartEvent inside the SubProcess
    const initialTokenData: any = await processTokenFacade.getOldTokenFormat();
    subProcessTokenFacade.addResultForFlowNode(startEvent.id, initialTokenData.current);

    const startEventFlowNodeInfo: NextFlowNodeInfo<Model.Base.FlowNode> = new NextFlowNodeInfo(startEvent,
                                                                                               token,
                                                                                               processTokenFacade);

    await this._executeFlowNode(startEventFlowNodeInfo, token, subProcessTokenFacade, subProcessModelFacade, executionContextFacade);

    // After all FlowNodes in the SubProcess have been executed, set the last "current" token value as a result of the whole SubProcess
    // and on the original ProcessTokenFacade, so that is is accessible by the original Process

    const finalTokenData: any = await subProcessTokenFacade.getOldTokenFormat();

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(flowNode);

    const finalResult: any = finalTokenData.current === undefined ? null : finalTokenData.current;

    processTokenFacade.addResultForFlowNode(flowNode.id, finalResult);
    token.payload = finalResult;

    await this.flowNodeInstanceService.persistOnExit(executionContextFacade, token, flowNode.id, flowNodeInstanceId);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }

  private async _executeFlowNode(flowNodeInfo: NextFlowNodeInfo<Model.Base.FlowNode>,
                                 token: Runtime.Types.ProcessToken,
                                 processTokenFacade: IProcessTokenFacade,
                                 processModelFacade: IProcessModelFacade,
                                 executionContextFacade: IExecutionContextFacade): Promise<void> {

    const flowNode: Model.Base.FlowNode = flowNodeInfo.flowNode;
    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo<Model.Base.FlowNode> =
      await flowNodeHandler.execute(flowNodeInfo,
                                    token,
                                    processTokenFacade,
                                    processModelFacade,
                                    executionContextFacade);

    if (nextFlowNodeInfo.flowNode !== undefined) {
      await this._executeFlowNode(nextFlowNodeInfo,
                                  nextFlowNodeInfo.token,
                                  nextFlowNodeInfo.processTokenFacade,
                                  processModelFacade,
                                  executionContextFacade);
    }
  }

}
