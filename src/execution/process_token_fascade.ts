export interface IProcessTokenFascade {
  addResultForFlowNode(flowNodeId: string, result: any): Promise<void>;
  getResultForFlowNode(flowNodeId: string): Promise<IProcessTokenResult>;
  getAllResultsForFlowNode(flowNodeId: string): Promise<Array<IProcessTokenResult>>;

}

export interface IProcessTokenResult {
  flowNodeId: string;
  result: any;
}

export class ProcessTokenFascade implements IProcessTokenFascade {

}