import { Definitions, IProcessModelPersistence, Model } from '@process-engine/process_engine_contracts';

export class ProcessModelPersistence implements IProcessModelPersistence {

  private _definitions: Array<Definitions> = [];

  private get definitions(): Array<Definitions> {
    return this._definitions;
  }

  public async persistProcessDefinitions(definitions: Definitions): Promise<void> {
    this.definitions.push(definitions);
  }

  public async getProcessModelById(processModelId: string): Promise<Model.Types.Process> {

    for (const definition of this._definitions) {

      for (const process of definition.processes) {

        if (process.id === processModelId) {
          return process;
        }
      }
    }
  }

  public async getProcessModels(): Promise<Array<Model.Types.Process>> {

    const allProcessModels: Array<Model.Types.Process> = [];

    for (const definition of this.definitions) {
      Array.prototype.push.apply(allProcessModels, definition.processes);
    }

    return allProcessModels;
  }
}
