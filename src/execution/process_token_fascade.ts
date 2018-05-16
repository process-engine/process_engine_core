import { ProcessToken } from "@process-engine/process_engine_contracts/dist/new_model/domains/runtime/types";
import { Model, Runtime, BpmnType } from '@process-engine/process_engine_contracts';

export interface IProcessTokenFascade {
  addResultForFlowNode(flowNodeId: string, result: any): Promise<void>;
  getResultForFlowNode(flowNodeId: string): Promise<IProcessTokenResult>;
  getAllResultsForFlowNode(flowNodeId: string): Promise<Array<IProcessTokenResult>>;
  getProcessTokenFascadeForParallelBranch(): Promise<IProcessTokenFascade>;
  mergeTokenHistory(processTokenToMerge: IProcessTokenFascade): Promise<void>;
  getAllResults(): Promise<Array<IProcessTokenResult>>;
  getOldTokenFormat(): Promise<any>;
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
    throw new Error("Method not implemented.");
  }
  public async getAllResultsForFlowNode(flowNodeId: string): Promise<IProcessTokenResult[]> {
    throw new Error("Method not implemented.");
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
    const tokenData: any = {
      data: {
        history: {},
        current: undefined,
      },
    };

    for (const tokenResult of tokenResults) {
      tokenData.data.history[tokenResult.flowNodeId] = tokenResult.result;
    }

    return tokenData;
  }
}
