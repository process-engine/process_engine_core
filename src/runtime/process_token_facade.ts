import {IFlowNodeInstanceResult, IProcessTokenFacade, Runtime} from '@process-engine/process_engine_contracts';

export class ProcessTokenFacade implements IProcessTokenFacade {
  private _correlationId: string;
  private _identity: any;
  private _processInstanceId: string;
  private _processModelId: string;
  private _processTokenResults: Array<IFlowNodeInstanceResult> = [];

  constructor(processInstanceId: string, processModelId: string, correlationId: string, identity: any) {
    this._processInstanceId = processInstanceId;
    this._processModelId = processModelId;
    this._correlationId = correlationId;
    this._identity = identity;
  }

  private get processInstanceId(): string {
    return this._processInstanceId;
  }

  private get processModelId(): string {
    return this._processModelId;
  }

  private get correlationId(): string {
    return this._correlationId;
  }

  private get identity(): any {
    return this._identity;
  }

  public getAllResults(): Array<IFlowNodeInstanceResult> {
    return this._processTokenResults;
  }

  public createProcessToken(payload?: any): Runtime.Types.ProcessToken {
    const token: Runtime.Types.ProcessToken = new Runtime.Types.ProcessToken();
    token.processInstanceId = this.processInstanceId;
    token.processModelId = this.processModelId;
    token.correlationId = this.correlationId;
    token.identity = this.identity;
    token.createdAt = new Date();
    token.payload = payload;

    return token;
  }

  public containsResultForFlowNodeInstance(flowNodeInstanceId: string): boolean {
    return this._processTokenResults.some((result: IFlowNodeInstanceResult) => result.flowNodeInstanceId === flowNodeInstanceId);
  }

  public addResultForFlowNode(flowNodeId: string, flowNodeInstanceId: string, result: any): void {
    const processTokenResult: IFlowNodeInstanceResult = {
      flowNodeId: flowNodeId,
      flowNodeInstanceId: flowNodeInstanceId,
      result: result,
    };
    this._processTokenResults.push(processTokenResult);
  }

  public importResults(processTokenResults: Array<IFlowNodeInstanceResult>): void {
    Array.prototype.push.apply(this._processTokenResults, processTokenResults);
  }

  public getProcessTokenFacadeForParallelBranch(): IProcessTokenFacade {

    const processTokenFacade: any = new ProcessTokenFacade(this.processInstanceId, this.processModelId, this.correlationId, this.identity);
    const allResults: Array<IFlowNodeInstanceResult> = this.getAllResults();
    processTokenFacade.importResults(allResults);

    return processTokenFacade;
  }

  public mergeTokenHistory(processTokenToMerge: IProcessTokenFacade): void {
    const allResultsToMerge: Array<IFlowNodeInstanceResult> = processTokenToMerge.getAllResults();
    Array.prototype.push.apply(this._processTokenResults, allResultsToMerge);
  }

  public getOldTokenFormat(): any {

    const tokenResults: Array<IFlowNodeInstanceResult> = this.getAllResults();

    if (tokenResults.length === 0) {
      return {
        history: {},
        current: undefined,
      };
    }

    const copiedResults: Array<IFlowNodeInstanceResult> = [];
    Array.prototype.push.apply(copiedResults, tokenResults);
    const currentResult: any = copiedResults.pop();

    const tokenData: any = {
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
