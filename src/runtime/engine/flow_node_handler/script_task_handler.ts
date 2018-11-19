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
                                    identity: IIdentity,
                                   ): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<NextFlowNodeInfo> {

    // ScriptTasks only produce two tokens in their lifetime.
    // Therefore, it is safe to assume that only one token exists at this point.
    const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.tokens[0];

    return this._executeHandler(onEnterToken, processTokenFacade, processModelFacade, identity);
  }

  private async _executeHandler(token: Runtime.Types.ProcessToken,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                identity: IIdentity,
                              ): Promise<NextFlowNodeInfo> {

    let result: any = {};

    try {
      result = await this._executeScriptTask(processTokenFacade, identity);
    } catch (error) {
      await this.persistOnError(token, error);

      throw error;
    }

    await processTokenFacade.addResultForFlowNode(this.scriptTask.id, result);
    token.payload = result;
    await this.persistOnExit(token);

    const nextFlowNodeInfo: NextFlowNodeInfo = await this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);

    return nextFlowNodeInfo;
  }

  private async _executeScriptTask(processTokenFacade: IProcessTokenFacade, identity: IIdentity): Promise<any> {

    const script: string = this.scriptTask.script;

    if (!script) {
      return undefined;
    }

    const tokenData: any = await processTokenFacade.getOldTokenFormat();
    let result: any;

    const scriptFunction: Function = new Function('token', 'identity', script);

    result = await scriptFunction.call(this, tokenData, identity);
    result = result === undefined
      ? null
      : result;

    return result;
  }
}
