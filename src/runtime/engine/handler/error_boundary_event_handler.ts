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
              decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>) {
    super(flowNodeInstanceService, loggingApiService, metricsService);
    this._decoratedHandler = decoratedHandler;
  }

  private get decoratedHandler(): FlowNodeHandler<Model.Base.FlowNode> {
    return this._decoratedHandler;
  }

  protected async executeInternally(errorBoundaryEvent: Model.Events.BoundaryEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {
    try {

      const nextFlowNodeInfo: NextFlowNodeInfo
        = await this.decoratedHandler.execute(errorBoundaryEvent, token, processTokenFacade, processModelFacade, identity);

      return nextFlowNodeInfo;

    } catch (err) {
      // if the decorated handler encountered an error, the next flow node after the ErrorBoundaryEvent is returned

      const boundaryEvents: Array<Model.Events.BoundaryEvent> = processModelFacade.getBoundaryEventsFor(errorBoundaryEvent);

      const boundaryEvent: Model.Events.BoundaryEvent = boundaryEvents.find((currentBoundaryEvent: Model.Events.BoundaryEvent) => {
        return currentBoundaryEvent.errorEventDefinition !== undefined;
      });

      if (!boundaryEvent) {
        throw new Error(`ErrorBoundaryEvent attached to node with id "${errorBoundaryEvent.id}" could not be found.`);
      }

      const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(boundaryEvent);

      return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
    }
  }
}
