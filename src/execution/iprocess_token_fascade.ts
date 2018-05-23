import { Model } from '@process-engine/process_engine_contracts';
import { IProcessTokenResult } from './iprocess_token_result';

export interface IProcessTokenFascade {
  addResultForFlowNode(flowNodeId: string, result: any): Promise<void>;
  getResultForFlowNode(flowNodeId: string): Promise<IProcessTokenResult>;
  getAllResultsForFlowNode(flowNodeId: string): Promise<Array<IProcessTokenResult>>;
  getProcessTokenFascadeForParallelBranch(): Promise<IProcessTokenFascade>;
  mergeTokenHistory(processTokenToMerge: IProcessTokenFascade): Promise<void>;
  getAllResults(): Promise<Array<IProcessTokenResult>>;
  getOldTokenFormat(): Promise<any>;
  evaluateMapperForSequenceFlow(sequenceFlow: Model.Types.SequenceFlow): Promise<void>;
  evaluateMapperForFlowNode(flowNode: Model.Base.FlowNode): Promise<void>;
}
