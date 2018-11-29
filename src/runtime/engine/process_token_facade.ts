import {IProcessTokenFacade, IProcessTokenResult, Model, Runtime} from '@process-engine/process_engine_contracts';

export class ProcessTokenFacade implements IProcessTokenFacade {
  private processTokenResults: Array<IProcessTokenResult> = [];
  private _processInstanceId: string;
  private _processModelId: string;
  private _correlationId: string;
  private _identity: any;

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

  public async getAllResults(): Promise<Array<IProcessTokenResult>> {
    return Promise.resolve(this.processTokenResults);
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

  public async addResultForFlowNode(flowNodeId: string, result: any): Promise<void> {
    const processTokenResult: IProcessTokenResult = {
      flowNodeId: flowNodeId,
      result: result,
    };
    this.processTokenResults.push(processTokenResult);
  }

  public async importResults(processTokenResults: Array<IProcessTokenResult>): Promise<void> {
    Array.prototype.push.apply(this.processTokenResults, processTokenResults);
  }

  public async getProcessTokenFacadeForParallelBranch(): Promise<IProcessTokenFacade> {

    const processTokenFacade: any = new ProcessTokenFacade(this.processInstanceId, this.processModelId, this.correlationId, this.identity);
    const allResults: Array<IProcessTokenResult> = await this.getAllResults();
    await processTokenFacade.importResults(allResults);

    return processTokenFacade;
  }

  public async mergeTokenHistory(processTokenToMerge: IProcessTokenFacade): Promise<void> {
    const allResultsToMerge: Array<IProcessTokenResult> = await processTokenToMerge.getAllResults();

    Array.prototype.push.apply(this.processTokenResults, allResultsToMerge);
  }

  public async getOldTokenFormat(): Promise<any> {

    const tokenResults: Array<IProcessTokenResult> = await this.getAllResults();

    if (tokenResults.length === 0) {
      return {
        history: {},
        current: undefined,
      };
    }

    const copiedResults: Array<IProcessTokenResult> = [];
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

  public async evaluateMapperForSequenceFlow(sequenceFlow: Model.Types.SequenceFlow): Promise<void> {

    const tokenData: any = await this.getOldTokenFormat();

    const mapper: string = this._getMapper(sequenceFlow);

    if (mapper !== undefined) {
      const newCurrent: any = (new Function('token', `return ${mapper}`)).call(tokenData, tokenData);

      const allResults: Array<IProcessTokenResult> = await this.getAllResults();
      const currentResult: IProcessTokenResult = allResults[allResults.length - 1];

      currentResult.result = newCurrent;
    }
  }

  public async evaluateMapperForFlowNode(flowNode: Model.Base.FlowNode): Promise<void> {

    const tokenData: any = await this.getOldTokenFormat();

    const mapper: string = this._getMapper(flowNode);

    if (mapper !== undefined) {
      const newCurrent: any = (new Function('token', `return ${mapper}`)).call(tokenData, tokenData);

      const allResults: Array<IProcessTokenResult> = await this.getAllResults();
      const currentResult: IProcessTokenResult = allResults[allResults.length - 1];

      currentResult.result = newCurrent;
    }
  }

  private _getMapper(sequenceFlowOrFlowNode: Model.Types.SequenceFlow | Model.Base.FlowNode): string {
    if (!sequenceFlowOrFlowNode.extensionElements
      || !sequenceFlowOrFlowNode.extensionElements.camundaExtensionProperties
      || !Array.isArray(sequenceFlowOrFlowNode.extensionElements.camundaExtensionProperties)) {
      return;
    }

    const mapperExtensionProperty: any = sequenceFlowOrFlowNode.extensionElements.camundaExtensionProperties.find((extensionProperty: any) => {
      return extensionProperty.name === 'mapper';
    });

    if (!mapperExtensionProperty) {
      return undefined;
    }

    return mapperExtensionProperty.value;
  }
}
