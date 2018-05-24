import { BpmnType, Model, Runtime } from '@process-engine/process_engine_contracts';
import { IProcessTokenFascade } from './iprocess_token_fascade';
import { IProcessTokenResult } from './iprocess_token_result';

export class ProcessTokenFascade implements IProcessTokenFascade {
  private processToken: Runtime.Types.ProcessToken;
  private processTokenResults: Array<IProcessTokenResult> = [];

  constructor(processToken: Runtime.Types.ProcessToken) {
    this.processToken = processToken;
  }

  public async getAllResults(): Promise<Array<IProcessTokenResult>> {
    return Promise.resolve(this.processTokenResults);
  }

  public async addResultForFlowNode(flowNodeId: string, result: any): Promise<void> {
    const processTokenResult: IProcessTokenResult = {
      flowNodeId: flowNodeId,
      result: result,
    };
    this.processTokenResults.push(processTokenResult);
  }

  public async getResultForFlowNode(flowNodeId: string): Promise<IProcessTokenResult> {
    throw new Error('Method not implemented.');
  }

  public async getAllResultsForFlowNode(flowNodeId: string): Promise<Array<IProcessTokenResult>> {
    throw new Error('Method not implemented.');
  }

  protected async importResults(processTokenResults: Array<IProcessTokenResult>): Promise<void> {
    Array.prototype.push.apply(this.processTokenResults, processTokenResults);
  }

  public async getProcessTokenFascadeForParallelBranch(): Promise<IProcessTokenFascade> {
    const processToken: any = new Runtime.Types.ProcessToken();

    const processTokenFascade: any = new ProcessTokenFascade(processToken);
    const allResults: Array<IProcessTokenResult> = await this.getAllResults();
    await processTokenFascade.importResults(allResults);

    return processTokenFascade;
  }

  public async mergeTokenHistory(processTokenToMerge: IProcessTokenFascade): Promise<void> {
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
