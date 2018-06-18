import { Definitions, Model, IProcessModelPersistance } from '@process-engine/process_engine_contracts';

export class ProcessModelPersistance implements IProcessModelPersistance {

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
}