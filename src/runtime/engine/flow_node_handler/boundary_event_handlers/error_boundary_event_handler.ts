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

export class ErrorBoundaryEventHandler extends FlowNodeHandler<Model.Events.BoundaryEvent> {

  private _decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>;

  constructor(flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>,
              errorBoundaryEventModel: Model.Events.BoundaryEvent) {
    super(flowNodeInstanceService, loggingApiService, metricsService, errorBoundaryEventModel);
    this._decoratedHandler = decoratedHandler;
  }

  private get errorBoundaryEvent(): Model.Events.BoundaryEvent {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {
    try {
      const nextFlowNodeInfo: NextFlowNodeInfo
        = await this._decoratedHandler.execute(token, processTokenFacade, processModelFacade, identity, this.previousFlowNodeInstanceId);

      return nextFlowNodeInfo;

    } catch (err) {
      const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.errorBoundaryEvent);

      return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
    }
  }

  public async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                identity: IIdentity,
                              ): Promise<NextFlowNodeInfo> {

    throw new Error('Not implemented yet.');
  }
}
