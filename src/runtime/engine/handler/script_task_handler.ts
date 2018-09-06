import {IMetricsService} from '@process-engine/metrics_api_contracts';
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

  constructor(flowNodeInstanceService: IFlowNodeInstanceService, metricsService: IMetricsService) {
    super(flowNodeInstanceService, metricsService);
  }

  protected async executeInternally(scriptTask: Model.Activities.ScriptTask,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(scriptTask, token);

    const script: string = scriptTask.script;
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

      await this.persistOnError(scriptTask, token, error);

      throw error;
    }
    const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(scriptTask);

    await processTokenFacade.addResultForFlowNode(scriptTask.id, result);
    token.payload = result;

    await this.persistOnExit(scriptTask, token);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }
}
