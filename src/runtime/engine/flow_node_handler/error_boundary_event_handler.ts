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

  private get decoratedHandler(): FlowNodeHandler<Model.Base.FlowNode> {
    return this._decoratedHandler;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {
    try {
      const nextFlowNodeInfo: NextFlowNodeInfo
        = await this.decoratedHandler.execute(token, processTokenFacade, processModelFacade, identity);

      return nextFlowNodeInfo;

    } catch (err) {
      const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.errorBoundaryEvent);

      return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
    }
  }
}
