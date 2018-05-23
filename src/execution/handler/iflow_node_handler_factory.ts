import { Model } from '@process-engine/process_engine_contracts';
import {
  IProcessModelFascade,
} from './../../index';
import { IFlowNodeHandler } from './iflow_node_handler';

export interface IFlowNodeHandlerFactory {
  create<TFlowNode extends Model.Base.FlowNode>(flowNode: TFlowNode, processModelFascade: IProcessModelFascade): Promise<IFlowNodeHandler<TFlowNode>>;
}
