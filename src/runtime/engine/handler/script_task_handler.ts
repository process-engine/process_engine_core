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

  protected async executeInternally(scriptTask: Model.Activities.ScriptTask,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();

    await this.flowNodeInstanceService.persistOnEnter(executionContextFacade, token, scriptTask.id, flowNodeInstanceId);

    const script: string = scriptTask.script;
    const context: ExecutionContext = executionContextFacade.getExecutionContext();

    if (!script) {
      return undefined;
    }

    const tokenData: any = await processTokenFacade.getOldTokenFormat();
    let result: any;

    const scriptFunction: Function = new Function('token', 'context', script);

    result = await scriptFunction.call(this, tokenData, context);

    const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(scriptTask);

    result = result === undefined ? null : result;

    await processTokenFacade.addResultForFlowNode(scriptTask.id, result);
    token.payload = result;

    await this.flowNodeInstanceService.persistOnExit(executionContextFacade, token, scriptTask.id, flowNodeInstanceId);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }
}
