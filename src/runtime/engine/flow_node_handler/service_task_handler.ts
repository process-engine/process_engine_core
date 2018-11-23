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

  private _container: IContainer = undefined;

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
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    if (this.serviceTask.type === Model.Activities.ServiceTaskType.external) {
      return this._executeServiceTaskByType('ExternalServiceTaskHandler', token, processTokenFacade, processModelFacade, identity);
    }

    return this._executeServiceTaskByType('InternalServiceTaskHandler', token, processTokenFacade, processModelFacade, identity);
  }

  private async _executeServiceTaskByType(serviceTaskHandlerName: string,
                                          token: Runtime.Types.ProcessToken,
                                          processTokenFacade: IProcessTokenFacade,
                                          processModelFacade: IProcessModelFacade,
                                          identity: IIdentity,
                                         ): Promise<NextFlowNodeInfo> {

    const serviceTaskHandler: FlowNodeHandler<Model.Activities.ServiceTask> =
      await this._container.resolveAsync<FlowNodeHandler<Model.Activities.ServiceTask>>(serviceTaskHandlerName, [this.flowNode]);

    return serviceTaskHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);
  }
}
