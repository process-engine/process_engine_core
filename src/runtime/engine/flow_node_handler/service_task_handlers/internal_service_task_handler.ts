import {IContainer} from 'addict-ioc';
import * as Bluebird from 'bluebird';
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

import {FlowNodeHandlerInterruptable} from '../index';

export class InternalServiceTaskHandler extends FlowNodeHandlerInterruptable<Model.Activities.ServiceTask> {

  private _container: IContainer;

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

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade,
                                  identity: IIdentity,
                                 ): Promise<NextFlowNodeInfo> {

    const handlerPromise: Bluebird<any> = new Bluebird<any>(async(resolve: Function, reject: Function): Promise<void> => {

      let nextFlowNodeInfo: NextFlowNodeInfo;

      const serviceTaskHasNoInvocation: boolean = this.serviceTask.invocation === undefined;

      if (serviceTaskHasNoInvocation) {
        this.logger.verbose('ServiceTask has no invocation. Skipping execution.');

        processTokenFacade.addResultForFlowNode(this.serviceTask.id, {});
        token.payload = {};

        nextFlowNodeInfo = await this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);

        return resolve(nextFlowNodeInfo);
      }

      const executionPromise: Bluebird<any> = this._executeInternalServiceTask(token, processTokenFacade, identity);

      this.onInterruptedCallback = async(interruptionToken: Runtime.Types.ProcessToken): Promise<void> => {
        await processTokenFacade.addResultForFlowNode(this.serviceTask.id, interruptionToken.payload);
        executionPromise.cancel();
        handlerPromise.cancel();

        return resolve();
      };

      this.logger.verbose('Executing internal ServiceTask');
      const result: any = await executionPromise;

      processTokenFacade.addResultForFlowNode(this.serviceTask.id, result);
      token.payload = result;

      await this.persistOnExit(token);

      nextFlowNodeInfo = await this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);

      return resolve(nextFlowNodeInfo);
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
  private _executeInternalServiceTask(token: Runtime.Types.ProcessToken,
                                      processTokenFacade: IProcessTokenFacade,
                                      identity: IIdentity,
                                     ): Bluebird<any> {

    return new Bluebird<any>(async(resolve: Function, reject: Function, onCancel: Function): Promise<void> => {

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

      return resolve(result);
    });
  }
}
