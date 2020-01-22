import {
  BoundaryEvent,
  FlowNode,
  IBoundaryEventHandler,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  ProcessToken,
} from '@process-engine/process_engine_contracts';

export class FlowNodeHandlerFactoryMock implements IFlowNodeHandlerFactory {

  public async create<TFlowNode extends FlowNode>(flowNode: TFlowNode, processToken?: ProcessToken): Promise<IFlowNodeHandler<TFlowNode>> {
    return {} as any;
  }

  public async createForBoundaryEvent(flowNode: BoundaryEvent): Promise<IBoundaryEventHandler> {
    return {} as any;
  }

}
