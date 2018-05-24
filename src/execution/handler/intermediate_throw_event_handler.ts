import { Model, Runtime } from '@process-engine/process_engine_contracts';
import {
  IExecutionContextFascade,
  IProcessModelFascade,
  IProcessTokenFascade,
  NextFlowNodeInfo,
} from './../../index';
import { IFlowNodeHandlerFactory } from './iflow_node_handler_factory';
import { FlowNodeHandler } from './index';

export class IntermediateThrowEventHandler extends FlowNodeHandler<Model.Events.Event> {
  protected async executeIntern(flowNode: Model.Events.Event,
                                processTokenFascade: IProcessTokenFascade,
                                processModelFascade: IProcessModelFascade,
                                executionContextFascade: IExecutionContextFascade): Promise<NextFlowNodeInfo> {

    const nextFlowNode: Model.Base.FlowNode = processModelFascade.getNextFlowNodeFor(flowNode);

    return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);
  }
}
