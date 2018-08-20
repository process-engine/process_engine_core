import {
  ExecutionContext,
  IExecutionContextFacade,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class ScriptTaskHandler extends FlowNodeHandler<Model.Activities.ScriptTask> {

  private _flowNodeInstanceService: IFlowNodeInstanceService = undefined;

  constructor(flowNodeInstanceService: IFlowNodeInstanceService) {
    super();
    this._flowNodeInstanceService = flowNodeInstanceService;
  }

  private get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
  }

  protected async executeInternally(flowNodeInfo: NextFlowNodeInfo<Model.Activities.ScriptTask>,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo<Model.Base.FlowNode>> {

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();
    const flowNode: Model.Activities.ScriptTask = flowNodeInfo.flowNode;

    await this.flowNodeInstanceService.persistOnEnter(executionContextFacade, token, flowNode.id, flowNodeInstanceId);

    const script: string = flowNode.script;
    const context: ExecutionContext = executionContextFacade.getExecutionContext();

    if (!script) {
      return undefined;
    }

    const tokenData: any = await processTokenFacade.getOldTokenFormat();
    let result: any;

    try {

      const scriptFunction: Function = new Function('token', 'context', script);

      result = await scriptFunction.call(this, tokenData, context);
      result = result === undefined ? null : result;

    } catch (error) {

      await this.flowNodeInstanceService.persistOnError(executionContextFacade, token, flowNode.id, flowNodeInstanceId, error);

      throw error;
    }
    const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(flowNode);

    await processTokenFacade.addResultForFlowNode(flowNode.id, result);
    token.payload = result;

    await this.flowNodeInstanceService.persistOnExit(executionContextFacade, token, flowNode.id, flowNodeInstanceId);

    return new NextFlowNodeInfo(nextFlowNode, flowNode, token, processTokenFacade);
  }
}
