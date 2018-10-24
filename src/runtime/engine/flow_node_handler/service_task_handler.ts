import {Logger} from 'loggerhythm';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {IExternalTaskRepository} from '@process-engine/external_task_api_contracts';
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

import {IContainer} from 'addict-ioc';

import {FlowNodeHandler} from './index';

const logger: Logger = Logger.createLogger('processengine:runtime:service_task');

export class ServiceTaskHandler extends FlowNodeHandler<Model.Activities.ServiceTask> {

  private _container: IContainer;
  private _eventAggregator: IEventAggregator;
  private _externalTaskRepository: IExternalTaskRepository;

  constructor(
    container: IContainer,
    eventAggregator: IEventAggregator,
    externalTaskRepository: IExternalTaskRepository,
    flowNodeInstanceService: IFlowNodeInstanceService,
    loggingApiService: ILoggingApi,
    metricsService: IMetricsApi) {
    super(flowNodeInstanceService, loggingApiService, metricsService);

    this._container = container;
    this._eventAggregator = eventAggregator;
    this._externalTaskRepository = externalTaskRepository;
  }

  private get container(): IContainer {
    return this._container;
  }

  protected async executeInternally(
    serviceTask: Model.Activities.ServiceTask,
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(serviceTask, token);

    let result: any;

    const serviceTaskHasNoInvocation: boolean = serviceTask.invocation === undefined;

    const isInternalTask: boolean = serviceTask.type !== Model.Activities.ServiceTaskType.external;

    if (serviceTaskHasNoInvocation && isInternalTask) {
      logger.verbose('ServiceTask has no invocation. Skipping execution.');
      result = {};
    } else if (isInternalTask) {
      logger.verbose('Execute internal ServiceTask');
      result = await this._executeInternalServiceTask(serviceTask, token, processTokenFacade, identity);
    } else {
      logger.verbose('Execute external ServiceTask');
      result = await this._executeExternalServiceTask(serviceTask, token, processTokenFacade, identity);
    }

    processTokenFacade.addResultForFlowNode(serviceTask.id, result);
    token.payload = result;

    await this.persistOnExit(serviceTask, token);

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(serviceTask);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }

  /**
   * Executes the given ServiceTask internally.
   * The ServiceTaskHandler handles all execution.
   *
   * @async
   * @param   serviceTask        The ServiceTask to execute.
   * @param   token              The current ProcessToken.
   * @param   processTokenFacade The Facade for accessing all ProcessTokens of the
   *                             currently running ProcessInstance.
   * @param   identity           The identity that started the ProcessInstance.
   * @returns                    The ServiceTask's result.
   */
  private async _executeInternalServiceTask(
    serviceTask: Model.Activities.ServiceTask,
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    identity: IIdentity): Promise<any> {

    const isMethodInvocation: boolean = serviceTask.invocation instanceof Model.Activities.MethodInvocation;

    if (!isMethodInvocation) {
      const notSupportedErrorMessage: string = 'Internal ServiceTasks must use MethodInvocations!';
      logger.error(notSupportedErrorMessage);

      throw new UnprocessableEntityError(notSupportedErrorMessage);
    }

    const tokenData: any = await processTokenFacade.getOldTokenFormat();

    const invocation: Model.Activities.MethodInvocation = serviceTask.invocation as Model.Activities.MethodInvocation;

    const serviceInstance: any = await this.container.resolveAsync(invocation.module);

    const evaluateParamsFunction: Function = new Function('context', 'token', `return ${invocation.params}`);
    const argumentsToPassThrough: Array<any> = evaluateParamsFunction.call(tokenData, identity, tokenData) || [];

    const serviceMethod: Function = serviceInstance[invocation.method];

    if (!serviceMethod) {
      const error: Error = new Error(`Method '${invocation.method}' not found on target module '${invocation.module}'!`);
      await this.persistOnError(serviceTask, token, error);
      throw error;
    }

    const result: any = await serviceMethod.call(serviceInstance, ...argumentsToPassThrough);

    return result;
  }

  /**
   * Creates a new ExternalTask and delegates its execution to an
   * external Service.
   * The handler will be suspended, until the ExternalTask has finished.
   *
   * @async
   * @param   serviceTask The ServiceTask to execute.
   * @param   token       The current ProcessToken.
   * @param   processTokenFacade The Facade for accessing all ProcessTokens of the
   *                             currently running ProcessInstance.
   * @param   identity           The identity that started the ProcessInstance.
   * @returns             The ServiceTask's result.
   */
  private async _executeExternalServiceTask(
    serviceTask: Model.Activities.ServiceTask,
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    identity: IIdentity): Promise<any> {

    const isInternalTaskInvocation: boolean = serviceTask.invocation instanceof Model.Activities.MethodInvocation;

    if (isInternalTaskInvocation) {
      const notSupportedErrorMessage: string = 'External ServiceTasks cannot perform MethodInvocations!';
      logger.error(notSupportedErrorMessage);

      throw new UnprocessableEntityError(notSupportedErrorMessage);
    }

    return new Promise(async (resolve: Function, reject: Function): Promise<any> => {

      const externalTaskFinishedEventName: string = `/externaltask/flownodeinstance/${this.flowNodeInstanceId}/finished`;

      const messageReceivedCallback: Function = async (message: any): Promise<void> => {

        await this.persistOnResume(serviceTask, token);

        if (subscription) {
          subscription.dispose();
        }

        if (message.error) {
          logger.error(`External processing of ServiceTask failed!`, message.error);
          await this.persistOnError(serviceTask, token, message.error);

          throw message.error;
        }

        logger.verbose('External processing of the ServiceTask finished successfully.');
        resolve(message.result);
      };

      const subscription: ISubscription = this._eventAggregator.subscribeOnce(externalTaskFinishedEventName, messageReceivedCallback);

      const tokenData: any = await processTokenFacade.getOldTokenFormat();
      const payload = this._getPayload(serviceTask, token, tokenData, identity);

      logger.verbose('Persist ServiceTask as ExternalTask.');
      await this
        ._externalTaskRepository
        .create(serviceTask.topic, token.correlationId, token.processInstanceId, this.flowNodeInstanceId, token.identity, payload);

      await this.persistOnSuspend(serviceTask, token);

      const externalTaskCreatedEventName = `/externaltask/topic/${serviceTask.topic}/created`;
      this._eventAggregator.publish(externalTaskCreatedEventName);

      logger.verbose('Waiting for ServiceTask to be finished by an external worker.');
    });
  }

  private _getPayload(serviceTask: Model.Activities.ServiceTask, token: Runtime.Types.ProcessToken, tokenData: any, identity: IIdentity): any {

    const isPayloadInServiceTask = serviceTask.payload !== undefined;

    if (isPayloadInServiceTask) {

      const evaluatePayloadFunction: Function = new Function('context', 'token', `return ${serviceTask.payload}`);
      return evaluatePayloadFunction.call(tokenData, identity, tokenData);
    } else {

      return token.payload;
    }
  }
}
