import { BpmnType, Model, Runtime } from '@process-engine/process_engine_contracts';
import { ProcessToken } from '@process-engine/process_engine_contracts/dist/new_model/domains/runtime/types';

export interface IProcessTokenFascade {
  addResultForFlowNode(flowNodeId: string, result: any): Promise<void>;
  getResultForFlowNode(flowNodeId: string): Promise<IProcessTokenResult>;
  getAllResultsForFlowNode(flowNodeId: string): Promise<Array<IProcessTokenResult>>;
  getProcessTokenFascadeForParallelBranch(): Promise<IProcessTokenFascade>;
  mergeTokenHistory(processTokenToMerge: IProcessTokenFascade): Promise<void>;
  getAllResults(): Promise<Array<IProcessTokenResult>>;
  getOldTokenFormat(): Promise<any>;
  evaluateMapper(sequenceFlow: Model.Types.SequenceFlow): Promise<void>;
}

export interface IProcessTokenResult {
  flowNodeId: string;
  result: any;
}

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
  public async getProcessTokenFascadeForParallelBranch(): Promise<IProcessTokenFascade> {
    const processToken: any = new Runtime.Types.ProcessToken();

    return Promise.resolve(new ProcessTokenFascade(processToken));
  }
  public async mergeTokenHistory(processTokenToMerge: IProcessTokenFascade): Promise<void> {

    if (this.processToken.data === undefined) {
      this.processToken.data = {};
    }

    if (this.processToken.data.history === undefined) {
      this.processToken.data.history = {};
    }

    const tokenDataToMerge: any = await processTokenToMerge.getOldTokenFormat();

    this.processToken.data.history = {
      ...this.processToken.data.history,
      ...tokenDataToMerge,
    };

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

  public async evaluateMapper(sequenceFlow: Model.Types.SequenceFlow): Promise<void> {

    const tokenData: any = await this.getOldTokenFormat();

    const mapper: string = this._getMapper(sequenceFlow);

    if (mapper !== undefined) {
      const newCurrent: any = (new Function('token', 'return ' + mapper)).call(tokenData, tokenData);

      const allResults: Array<IProcessTokenResult> = await this.getAllResults();
      const currentResult: IProcessTokenResult = allResults[allResults.length - 1];

      currentResult.result = newCurrent;
    }
  }

  private _getMapper(sequenceFlow: Model.Types.SequenceFlow): string {
    if (!sequenceFlow.extensionElements
      || !sequenceFlow.extensionElements.camundaExtensionProperties
      || !Array.isArray(sequenceFlow.extensionElements.camundaExtensionProperties)) {
      return;
    }

    const mapperExtensionProperty: any = sequenceFlow.extensionElements.camundaExtensionProperties.find((extensionProperty) => {
      return extensionProperty.name === 'mapper';
    });

    return mapperExtensionProperty.value;
  }
}
