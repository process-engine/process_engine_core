import {IContainer} from 'addict-ioc';

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

export class ServiceTaskHandler extends FlowNodeHandler<Model.Activities.ServiceTask> {

  private _childHandler: FlowNodeHandler<Model.Activities.ServiceTask>;
  private _container: IContainer = undefined;

  constructor(container: IContainer,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              serviceTaskModel: Model.Activities.ServiceTask) {

    super(flowNodeInstanceService, loggingApiService, metricsService, serviceTaskModel);
    this._container = container;
    this._childHandler = this._getChildHandler();
  }

  public getInstanceId(): string {
    return this._childHandler.getInstanceId();
  }

  private _getChildHandler(): FlowNodeHandler<Model.Activities.ServiceTask> {

    if (this.flowNode.type === Model.Activities.ServiceTaskType.external) {
      return this._container.resolve<FlowNodeHandler<Model.Activities.ServiceTask>>('ExternalServiceTaskHandler', [this.flowNode]);
    }

    return this._container.resolve<FlowNodeHandler<Model.Activities.ServiceTask>>('InternalServiceTaskHandler', [this.flowNode]);
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);

    if (this.serviceTask.type === Model.Activities.ServiceTaskType.external) {
      return this._executeServiceTaskByType('ExternalServiceTaskHandler', token, processTokenFacade, processModelFacade, identity);
    }

    return this._executeServiceTaskByType('InternalServiceTaskHandler', token, processTokenFacade, processModelFacade, identity);
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<NextFlowNodeInfo> {

    if (this.serviceTask.type === Model.Activities.ServiceTaskType.external) {
      return this._resumeServiceTaskByType('ExternalServiceTaskHandler', flowNodeInstance, processTokenFacade, processModelFacade, identity);
    }

    return this._resumeServiceTaskByType('InternalServiceTaskHandler', flowNodeInstance, processTokenFacade, processModelFacade, identity);
  }

  private async _executeServiceTaskByType(serviceTaskHandlerName: string,
                                          token: Runtime.Types.ProcessToken,
                                          processTokenFacade: IProcessTokenFacade,
                                          processModelFacade: IProcessModelFacade,
                                          identity: IIdentity,
                                         ): Promise<NextFlowNodeInfo> {

    const serviceTaskHandler: FlowNodeHandler<Model.Activities.ServiceTask> =
      await this._container.resolveAsync<FlowNodeHandler<Model.Activities.ServiceTask>>(serviceTaskHandlerName, [this.flowNode]);

    return this._childHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);
  }

  /**
   * Creates a new ExternalTask in the database that an external worker can
   * retrieve and process.
   *
   * @async
   * @param token              The current ProcessToken.
   * @param exernalTaskPayload The ExternalTask's payload.
   */
  private async _createExternalTask(token: Runtime.Types.ProcessToken, exernalTaskPayload: any): Promise<void> {

    logger.verbose('Persist ServiceTask as ExternalTask.');
    await this._externalTaskRepository.create(this.serviceTask.topic,
                                              token.correlationId,
                                              token.processModelId,
                                              token.processInstanceId,
                                              this.flowNodeInstanceId,
                                              token.identity,
                                              exernalTaskPayload);
  }

  /**
   * Sends a notification about a newly created ExternalTask.
   * This is part of the Long-polling feature of the ExternalTaskAPI.
   */
  private _publishExternalTaskCreatedNotification(): void {
    const externalTaskCreatedEventName: string = `/externaltask/topic/${this.serviceTask.topic}/created`;
    this._eventAggregator.publish(externalTaskCreatedEventName);
  }

  /**
   * Looks for an existing ExternalTask for the given FlowNodeInstance.
   *
   * @async
   * @param   flowNodeInstance The FlowNodeInstance for which to get an
   *                           ExternalTask.
   * @returns                  The retrieved ExternalTask, or undefined, if no
   *                           such ExternalTask exists.
   */
  private async _getExternalTaskForFlowNodeInstance(flowNodeInstance: Runtime.Types.FlowNodeInstance): Promise<ExternalTask<any>> {

    try {

      const matchingExternalTask: ExternalTask<any> =
        await this._externalTaskRepository.getByInstanceIds(flowNodeInstance.correlationId, flowNodeInstance.processInstanceId, flowNodeInstance.id);

      return matchingExternalTask;
    } catch (error) {
      logger.info('No external task has been stored for this FlowNodeInstance.');

    return serviceTaskHandler.resume(flowNodeInstance, processTokenFacade, processModelFacade, identity);
  }
}
