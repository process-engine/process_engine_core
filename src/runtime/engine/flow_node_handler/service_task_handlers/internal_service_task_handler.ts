import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';

import {InternalServerError, UnprocessableEntityError} from '@essential-projects/errors_ts';
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

import {FlowNodeHandler} from '../index';

export class InternalServiceTaskHandler extends FlowNodeHandler<Model.Activities.ServiceTask> {

  private _container: IContainer;

  private logger: Logger;

  constructor(container: IContainer,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              serviceTaskModel: Model.Activities.ServiceTask) {

    super(flowNodeInstanceService, loggingApiService, metricsService, serviceTaskModel);

    this._container = container;
    this.logger = Logger.createLogger(`processengine:internal_service_task:${serviceTaskModel.id}`);
  }

  private get serviceTask(): Model.Activities.ServiceTask {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity,
                                   ): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Executing internal ServiceTask instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Resuming internal ServiceTask instance ${flowNodeInstance.id}.`);

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.running:
        this.logger.verbose(`ServiceTask was unfinished. Resuming from the start.`);
        const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onEnter);

        return this._continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade, identity);
      case Runtime.Types.FlowNodeInstanceState.finished:
        this.logger.verbose(`ServiceTask was already finished. Skipping ahead.`);
        const onExitToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onExit);

        return this._continueAfterExit(onExitToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.error:
        this.logger.error(`Cannot resume ServiceTask instance ${flowNodeInstance.id}, because it previously exited with an error!`,
                     flowNodeInstance.error);
        throw flowNodeInstance.error;
      case Runtime.Types.FlowNodeInstanceState.terminated:
        const terminatedError: string = `Cannot resume ServiceTask instance ${flowNodeInstance.id}, because it was terminated!`;
        this.logger.error(terminatedError);
        throw new InternalServerError(terminatedError);
      default:
        const invalidStateError: string = `Cannot resume ServiceTask instance ${flowNodeInstance.id}, because its state cannot be determined!`;
        this.logger.error(invalidStateError);
        throw new InternalServerError(invalidStateError);
    }
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade,
                                  identity: IIdentity,
                                 ): Promise<NextFlowNodeInfo> {

    let result: any;

    const serviceTaskHasNoInvocation: boolean = this.serviceTask.invocation === undefined;

    if (serviceTaskHasNoInvocation) {
      this.logger.verbose('ServiceTask has no invocation. Skipping execution.');
      result = {};
    } else {
      this.logger.verbose('Executing internal ServiceTask');
      result = await this._executeInternalServiceTask(token, processTokenFacade, identity);
    }

    processTokenFacade.addResultForFlowNode(this.serviceTask.id, result);
    token.payload = result;

    await this.persistOnExit(token);

    return this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);
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
  private async _executeInternalServiceTask(token: Runtime.Types.ProcessToken,
                                            processTokenFacade: IProcessTokenFacade,
                                            identity: IIdentity,
                                           ): Promise<any> {

    const isMethodInvocation: boolean = this.serviceTask.invocation instanceof Model.Activities.MethodInvocation;

    if (!isMethodInvocation) {
      const notSupportedErrorMessage: string = 'Internal ServiceTasks must use MethodInvocations!';
      this.logger.error(notSupportedErrorMessage);

      throw new UnprocessableEntityError(notSupportedErrorMessage);
    }

    const tokenData: any = await processTokenFacade.getOldTokenFormat();

    const invocation: Model.Activities.MethodInvocation = this.serviceTask.invocation as Model.Activities.MethodInvocation;

    const serviceInstance: any = await this._container.resolveAsync(invocation.module);

    const evaluateParamsFunction: Function = new Function('context', 'token', `return ${invocation.params}`);
    const argumentsToPassThrough: Array<any> = evaluateParamsFunction.call(tokenData, identity, tokenData) || [];

    const serviceMethod: Function = serviceInstance[invocation.method];

    if (!serviceMethod) {
      const error: Error = new Error(`Method '${invocation.method}' not found on target module '${invocation.module}'!`);
      await this.persistOnError(token, error);
      throw error;
    }

    const result: any = await serviceMethod.call(serviceInstance, ...argumentsToPassThrough);

    return result;
  }
}
