import { IExecutionContextFascade, IProcessModelFascade, IProcessTokenFascade, Model,
  NextFlowNodeInfo, Runtime } from '@process-engine/process_engine_contracts';
import { FlowNodeHandler } from './index';

export class ErrorBoundaryEventHandler extends FlowNodeHandler<Model.Events.BoundaryEvent> {

  private _decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>;

  constructor(decoratedHandler: FlowNodeHandler<Model.Base.FlowNode>) {
    super();
    this._decoratedHandler = decoratedHandler;
  }

  private get decoratedHandler(): FlowNodeHandler<Model.Base.FlowNode> {
    return this._decoratedHandler;
  }

  protected async executeIntern(flowNode: Model.Events.BoundaryEvent,
                                processTokenFascade: IProcessTokenFascade,
                                processModelFascade: IProcessModelFascade,
                                executionContextFascade: IExecutionContextFascade): Promise<NextFlowNodeInfo> {
    try {

      const nextFlowNodeInfo: NextFlowNodeInfo
        = await this.decoratedHandler.execute(flowNode, processTokenFascade, processModelFascade, executionContextFascade);

      return nextFlowNodeInfo;

    } catch (err) {
      // if the decorated handler encountered an error, the next flow node after the ErrorBoundaryEvent is returned

      const boundaryEvents: Array<Model.Events.BoundaryEvent> = processModelFascade.getBoundaryEventsFor(flowNode);

      const boundaryEvent: Model.Events.BoundaryEvent = boundaryEvents.find((currentBoundaryEvent: Model.Events.BoundaryEvent) => {
        return currentBoundaryEvent.errorEventDefinition !== undefined;
      });

      if (!boundaryEvent) {
        throw new Error(`ErrorBoundaryEvent attached to node with id "${flowNode.id}" could not be found.`);
      }

      const nextFlowNode: Model.Base.FlowNode = processModelFascade.getNextFlowNodeFor(boundaryEvent);

      return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);
    }
  }
}
