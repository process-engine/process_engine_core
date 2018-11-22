import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';
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

const logger: Logger = Logger.createLogger('processengine:runtime:internal_service_task');

export class InternalServiceTaskHandler extends FlowNodeHandler<Model.Activities.ServiceTask> {

  private _container: IContainer;

  constructor(container: IContainer,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              serviceTaskModel: Model.Activities.ServiceTask) {

    super(flowNodeInstanceService, loggingApiService, metricsService, serviceTaskModel);

    this._container = container;
  }

  private get serviceTask(): Model.Activities.ServiceTask {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity,
                                   ): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);

    let result: any;

    const serviceTaskHasNoInvocation: boolean = this.serviceTask.invocation === undefined;

    if (serviceTaskHasNoInvocation) {
      logger.verbose('ServiceTask has no invocation. Skipping execution.');
      result = {};
    } else {
      logger.verbose('Executing internal ServiceTask');
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
      logger.error(notSupportedErrorMessage);

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
