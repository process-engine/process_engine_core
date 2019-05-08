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

import {ActivityHandler} from './activity_handler';

export class ScriptTaskHandler extends ActivityHandler<Model.Activities.ScriptTask> {

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
    return this.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing ScriptTask instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this.executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise = new Promise<any>(async (resolve: Function, reject: Function): Promise<void> => {
      try {
        let result = {};

        const executionPromise = this.executeScriptTask(processTokenFacade, identity);

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

        const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.scriptTask);

        return resolve(nextFlowNodeInfo);
      } catch (error) {
        await this.persistOnError(token, error);

        return reject(error);
      }
    });

    return handlerPromise;
  }

  private executeScriptTask(processTokenFacade: IProcessTokenFacade, identity: IIdentity): Promise<any> {

    return new Promise<any>(async (resolve: Function, reject: Function): Promise<void> => {
      try {

        const script = this.scriptTask.script;

        if (!script) {
          return undefined;
        }

        const scriptFunction = new Function('token', 'identity', script);

        const tokenData = processTokenFacade.getOldTokenFormat();

        let result = await scriptFunction.call(this, tokenData, identity);
        result = result === undefined
          ? {}
          : result;

        return resolve(result);
      } catch (error) {
        this.logger.error('Failed to run script!', error);

        return reject(error);
      }
    });
  }

}
