import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';
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

import {FlowNodeHandlerInterruptible} from '../index';

export class InternalServiceTaskHandler extends FlowNodeHandlerInterruptible<Model.Activities.ServiceTask> {

  private _container: IContainer;

  constructor(
    container: IContainer,
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    serviceTaskModel: Model.Activities.ServiceTask,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, serviceTaskModel);
    this._container = container;
    this.logger = Logger.createLogger(`processengine:internal_service_task:${serviceTaskModel.id}`);
  }

  private get serviceTask(): Model.Activities.ServiceTask {
    return super.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing internal ServiceTask instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const serviceTaskHasNoInvocation: boolean = this.serviceTask.invocation === undefined;
    if (serviceTaskHasNoInvocation) {
      this.logger.verbose('ServiceTask has no invocation. Skipping execution.');

      processTokenFacade.addResultForFlowNode(this.serviceTask.id, this.flowNodeInstanceId, {});
      token.payload = {};

      await this.persistOnExit(token);

      const nextFlowNodeInfo: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.serviceTask);

      return nextFlowNodeInfo;
    }

    const handlerPromise: Promise<any> = new Promise<any>(async(resolve: Function, reject: Function): Promise<void> => {

      const executionPromise: Promise<any> = this._executeInternalServiceTask(token, processTokenFacade, identity);

      this.onInterruptedCallback = (): void => {
        executionPromise.cancel();
        handlerPromise.cancel();

        return resolve();
      };

      try {
        this.logger.verbose('Executing internal ServiceTask');
        const result: any = await executionPromise;

        processTokenFacade.addResultForFlowNode(this.serviceTask.id, this.flowNodeInstanceId, result);
        token.payload = result;

        await this.persistOnExit(token);

        const nextFlowNodeInfo: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.serviceTask);

        return resolve(nextFlowNodeInfo);
      } catch (error) {
        this.logger.error(error);

        await this.persistOnError(token, error);

        return reject(error);
      }
    });

    return handlerPromise;
  }

  /**
   * Executes the given ServiceTask internally.
   * The ServiceTaskHandler handles all execution.
   *
   * @async
   * @param   token              The current ProcessToken.
   * @param   processTokenFacade The Facade for accessing all ProcessTokens of the
   *                             currently running ProcessInstance.
   * @param   identity           The identity that started the ProcessInstance.
   * @returns                    The ServiceTask's result.
   */
  private _executeInternalServiceTask(token: ProcessToken,
                                      processTokenFacade: IProcessTokenFacade,
                                      identity: IIdentity,
                                     ): Promise<any> {

    return new Promise<any>(async(resolve: Function, reject: Function, onCancel: Function): Promise<void> => {

      const isMethodInvocation: boolean = this.serviceTask.invocation instanceof Model.Activities.MethodInvocation;

      if (!isMethodInvocation) {
        const notSupportedErrorMessage: string = 'Internal ServiceTasks must use MethodInvocations!';
        this.logger.error(notSupportedErrorMessage);

        throw new UnprocessableEntityError(notSupportedErrorMessage);
      }

      const tokenData: any = processTokenFacade.getOldTokenFormat();

      const invocation: Model.Activities.MethodInvocation = this.serviceTask.invocation as Model.Activities.MethodInvocation;

      const serviceInstance: any = await this._container.resolveAsync(invocation.module);

      const evaluateParamsFunction: Function = new Function('context', 'token', `return ${invocation.params}`);
      const argumentsToPassThrough: Array<any> = evaluateParamsFunction.call(tokenData, identity, tokenData) || [];

      const serviceMethod: Function = serviceInstance[invocation.method];

      if (!serviceMethod) {
        const error: Error = new Error(`Method '${invocation.method}' not found on target module '${invocation.module}'!`);
        await this.persistOnError(token, error);

        return reject(error);
      }

      try {
        const result: any = await serviceMethod.call(serviceInstance, ...argumentsToPassThrough);

        return resolve(result);
      } catch (error) {
        return reject(error);
      }
    });
  }
}
