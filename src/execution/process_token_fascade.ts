export interface IProcessTokenFascade {
  addResultForFlowNode(flowNodeId: string, result: any): Promise<void>;
  getResultForFlowNode(flowNodeId: string): Promise<any>;
  getAllResultsForFlowNode(flowNodeId: string): Promise<Array<any>>;
}

export class ProcessTokenFascade {
  public async addResultForFlowNode(flowNodeId: string, result: any): Promise<void> {

  }
}