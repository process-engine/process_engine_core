import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
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

  constructor(flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              scriptTaskModel: Model.Activities.ScriptTask) {
    super(flowNodeInstanceService, loggingApiService, metricsService, scriptTaskModel);
  }

  private get scriptTask(): Model.Activities.ScriptTask {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);

    const script: string = this.scriptTask.script;

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

      await this.persistOnError(token, error);

      throw error;
    }
    const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(this.scriptTask);

    await processTokenFacade.addResultForFlowNode(this.scriptTask.id, result);
    token.payload = result;

    await this.persistOnExit(token);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }
}
