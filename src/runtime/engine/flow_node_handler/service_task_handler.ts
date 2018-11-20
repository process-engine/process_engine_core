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
              eventAggregator: IEventAggregator,
              externalTaskRepository: IExternalTaskRepository,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              serviceTaskModel: Model.Activities.ServiceTask) {

    super(flowNodeInstanceService, loggingApiService, metricsService, serviceTaskModel);

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

    const isInternalTask: boolean = this.serviceTask.type !== Model.Activities.ServiceTaskType.external;

    if (isInternalTask) {
      logger.verbose(`Resuming internal ServiceTask with instance ID ${flowNodeInstance.id} and FlowNode id ${flowNodeInstance.flowNodeId}`);

      return this._resumeInternalServiceTask(flowNodeInstance, processTokenFacade, processModelFacade, identity);
    }

    logger.verbose(`Resuming external ServiceTask with instance ID ${flowNodeInstance.id} and FlowNode id ${flowNodeInstance.flowNodeId}`);

    return this._resumeExternalServiceTask(flowNodeInstance, processTokenFacade, processModelFacade, identity);
  }

  private async _resumeInternalServiceTask(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                           processTokenFacade: IProcessTokenFacade,
                                           processModelFacade: IProcessModelFacade,
                                           identity: IIdentity,
                                          ): Promise<NextFlowNodeInfo> {

    // Internal ServiceTasks only produce two tokens in their lifetime.
    // We can safely assume here that only one token was stored in the list.
    const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.tokens[0];

    return this._executeHandler(onEnterToken, processTokenFacade, processModelFacade, identity);

  }

  private async _resumeExternalServiceTask(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                           processTokenFacade: IProcessTokenFacade,
                                           processModelFacade: IProcessModelFacade,
                                           identity: IIdentity,
                                          ): Promise<NextFlowNodeInfo> {

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.suspended:
        return this._continueAfterSuspend(flowNodeInstance, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.running:

        const resumeToken: Runtime.Types.ProcessToken =
          flowNodeInstance.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
            return token.type === Runtime.Types.ProcessTokenType.onResume;
          });

        const userTaskResultNotYetAwaited: boolean = resumeToken === undefined;

        if (userTaskResultNotYetAwaited) {
          return this._continueAfterEnter(flowNodeInstance, processTokenFacade, processModelFacade);
        }

        return this._continueAfterResume(resumeToken, processTokenFacade, processModelFacade);
      default:
        throw new InternalServerError(`Cannot resume extenal ServiceTask instance ${flowNodeInstance.id}, because it was already finished!`);
    }
  }

  private async _executeHandler(token: Runtime.Types.ProcessToken,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                identity: IIdentity,
                               ): Promise<NextFlowNodeInfo> {

    let result: any;

    const serviceTaskHasNoInvocation: boolean = this.serviceTask.invocation === undefined;

    const isInternalTask: boolean = this.serviceTask.type !== Model.Activities.ServiceTaskType.external;

    if (serviceTaskHasNoInvocation && isInternalTask) {
      logger.verbose('ServiceTask has no invocation. Skipping execution.');
      result = {};
    } else if (isInternalTask) {
      logger.verbose('Execute internal ServiceTask');
      result = await this._executeInternalServiceTask(token, processTokenFacade, identity);
    } else {
      logger.verbose('Execute external ServiceTask');
      result = await this._executeExternalServiceTask(token, processTokenFacade, identity);
    }

    processTokenFacade.addResultForFlowNode(this.serviceTask.id, result);
    token.payload = result;

    await this.persistOnExit(token);

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.serviceTask);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);

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

    const serviceTaskHandler: FlowNodeHandler<Model.Activities.ServiceTask> =
      await this._container.resolveAsync<FlowNodeHandler<Model.Activities.ServiceTask>>(serviceTaskHandlerName, [this.flowNode]);

    return this._childHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);
  }
}
