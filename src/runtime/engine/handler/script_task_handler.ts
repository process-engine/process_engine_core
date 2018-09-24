import {IIdentity} from '@essential-projects/iam_contracts';

import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class ScriptTaskHandler extends FlowNodeHandler<Model.Activities.ScriptTask> {

  constructor(flowNodeInstanceService: IFlowNodeInstanceService, metricsService: IMetricsApi) {
    super(flowNodeInstanceService, metricsService);
  }

  protected async executeInternally(scriptTask: Model.Activities.ScriptTask,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(scriptTask, token);

    const script: string = scriptTask.script;

    if (!script) {
      return undefined;
    }

    const tokenData: any = await processTokenFacade.getOldTokenFormat();
    let result: any;

    try {

      const scriptFunction: Function = new Function('token', 'identity', script);

      result = await scriptFunction.call(this, tokenData, identity);
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
