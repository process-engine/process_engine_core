import * as Bluebird from 'bluebird';
import {Logger} from 'loggerhythm';

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

import {FlowNodeHandlerInterruptable} from './index';

export class ScriptTaskHandler extends FlowNodeHandlerInterruptable<Model.Activities.ScriptTask> {

  constructor(flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              scriptTaskModel: Model.Activities.ScriptTask) {
    super(flowNodeInstanceService, loggingApiService, metricsService, scriptTaskModel);
    this.logger = new Logger(`processengine:script_task_handler:${scriptTaskModel.id}`);
  }

  private get scriptTask(): Model.Activities.ScriptTask {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity,
                                   ): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Executing ScriptTask instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade,
                                  identity: IIdentity,
                                 ): Promise<NextFlowNodeInfo> {

    const handlerPromise: Bluebird<any> = new Bluebird<any>(async(resolve: Function, reject: Function): Promise<void> => {

      let result: any = {};

      try {
        const executionPromise: Bluebird<any> = this._executeScriptTask(processTokenFacade, identity);

        this.onInterruptedCallback = (interruptionToken: Runtime.Types.ProcessToken): void => {
          processTokenFacade.addResultForFlowNode(this.scriptTask.id, interruptionToken.payload);
          executionPromise.cancel();
          handlerPromise.cancel();

          return resolve();
        };
        result = await executionPromise;
      } catch (error) {
        await this.persistOnError(token, error);

        return reject(error);
      }

      processTokenFacade.addResultForFlowNode(this.scriptTask.id, result);
      token.payload = result;
      await this.persistOnExit(token);

      const nextFlowNodeInfo: NextFlowNodeInfo = await this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  private _executeScriptTask(processTokenFacade: IProcessTokenFacade, identity: IIdentity): Bluebird<any> {

    return new Bluebird<any>(async(resolve: Function, reject: Function, onCancel: Function): Promise<void> => {

      const script: string = this.scriptTask.script;

      if (!script) {
        return undefined;
      }

      const tokenData: any = processTokenFacade.getOldTokenFormat();
      let result: any;

      const scriptFunction: Function = new Function('token', 'identity', script);
      try {
        result = await scriptFunction.call(this, tokenData, identity);
        result = result === undefined
          ? null
          : result;

        return resolve(result);
      } catch (error) {
        this.logger.error('Failed to run script!', error);

        return reject(error);
      }

    });
  }
}
