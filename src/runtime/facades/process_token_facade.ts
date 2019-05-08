import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {IFlowNodeInstanceResult, IProcessTokenFacade} from '@process-engine/process_engine_contracts';

export class ProcessTokenFacade implements IProcessTokenFacade {

  private correlationId: string;
  private identity: any;
  private processInstanceId: string;
  private processModelId: string;
  private processTokenResults: Array<IFlowNodeInstanceResult> = [];

  constructor(processInstanceId: string, processModelId: string, correlationId: string, identity: any) {
    this.processInstanceId = processInstanceId;
    this.processModelId = processModelId;
    this.correlationId = correlationId;
    this.identity = identity;
  }

  public getAllResults(): Array<IFlowNodeInstanceResult> {
    return this.processTokenResults;
  }

  public createProcessToken(payload?: any): ProcessToken {
    const token: ProcessToken = new ProcessToken();
    token.processInstanceId = this.processInstanceId;
    token.processModelId = this.processModelId;
    token.correlationId = this.correlationId;
    token.identity = this.identity;
    token.createdAt = new Date();
    token.payload = payload;

    return token;
  }

  public containsResultForFlowNodeInstance(flowNodeInstanceId: string): boolean {
    return this.processTokenResults.some((result: IFlowNodeInstanceResult): boolean => result.flowNodeInstanceId === flowNodeInstanceId);
  }

  public addResultForFlowNode(flowNodeId: string, flowNodeInstanceId: string, result: any): void {
    const processTokenResult: IFlowNodeInstanceResult = {
      flowNodeId: flowNodeId,
      flowNodeInstanceId: flowNodeInstanceId,
      result: result,
    };
    this.processTokenResults.push(processTokenResult);
  }

  public importResults(processTokenResults: Array<IFlowNodeInstanceResult>): void {
    Array.prototype.push.apply(this.processTokenResults, processTokenResults);
  }

  public getProcessTokenFacadeForParallelBranch(): IProcessTokenFacade {

    const processTokenFacade = new ProcessTokenFacade(this.processInstanceId, this.processModelId, this.correlationId, this.identity);
    const allResults = this.getAllResults();
    processTokenFacade.importResults(allResults);

    return processTokenFacade;
  }

  public mergeTokenHistory(processTokenToMerge: IProcessTokenFacade): void {
    const allResultsToMerge = processTokenToMerge.getAllResults();
    Array.prototype.push.apply(this.processTokenResults, allResultsToMerge);
  }

  public getOldTokenFormat(): any {

    const tokenResults = this.getAllResults();

    if (tokenResults.length === 0) {
      return {
        history: {},
        current: undefined,
      };
    }

    const copiedResults: Array<IFlowNodeInstanceResult> = [];
    Array.prototype.push.apply(copiedResults, tokenResults);
    const currentResult = copiedResults.pop();

    const tokenData = {
      history: {},
      current: currentResult ? currentResult.result : undefined,
    };

    for (const tokenResult of copiedResults) {
      tokenData.history[tokenResult.flowNodeId] = tokenResult.result;
    }

    tokenData.history[currentResult.flowNodeId] = currentResult.result;

    return tokenData;
  }

}
