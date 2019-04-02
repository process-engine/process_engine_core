import {Logger} from 'loggerhythm';

import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {FlowNodeHandler} from './index';

export class ScriptTaskHandler extends FlowNodeHandler<Model.Activities.ScriptTask> {

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    scriptTaskModel: Model.Activities.ScriptTask,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, scriptTaskModel);
    this.logger = new Logger(`processengine:script_task_handler:${scriptTaskModel.id}`);
  }

  private get scriptTask(): Model.Activities.ScriptTask {
    return super.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing ScriptTask instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise: Promise<any> = new Promise<any>(async(resolve: Function, reject: Function): Promise<void> => {
      try {
        let result: any = {};

        const executionPromise: Promise<any> = this._executeScriptTask(processTokenFacade, identity);

        this.onInterruptedCallback = (interruptionToken: ProcessToken): void => {
          processTokenFacade.addResultForFlowNode(this.scriptTask.id, this.flowNodeInstanceId, interruptionToken.payload);
          executionPromise.cancel();
          handlerPromise.cancel();

          return resolve();
        };
        result = await executionPromise;

        processTokenFacade.addResultForFlowNode(this.scriptTask.id, this.flowNodeInstanceId, result);
        token.payload = result;
        await this.persistOnExit(token);

        const nextFlowNodeInfo: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.scriptTask);

        return resolve(nextFlowNodeInfo);
      } catch (error) {
        await this.persistOnError(token, error);

        return reject(error);
      }
    });

    return handlerPromise;
  }

  private _executeScriptTask(processTokenFacade: IProcessTokenFacade, identity: IIdentity): Promise<any> {

    return new Promise<any>(async(resolve: Function, reject: Function, onCancel: Function): Promise<void> => {
      try {

        const script: string = this.scriptTask.script;

        if (!script) {
          return undefined;
        }

        const scriptFunction: Function = new Function('token', 'identity', script);

        const tokenData: any = processTokenFacade.getOldTokenFormat();

        let result: any = await scriptFunction.call(this, tokenData, identity);
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
