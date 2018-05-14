import { Runtime, Model, Definitions } from '@process-engine/process_engine_contracts';
import { IDatastoreService } from '@process-engine/data_model_contracts';
import {IProcessEngineStorageService} from './index';
import { IIamService } from '@essential-projects/core_contracts';

export class ProcessEngineStorageService implements IProcessEngineStorageService {
  
  private _datastoreService: IDatastoreService = undefined;
  private _iamService: IDatastoreService = undefined;

  constructor(datastoreService: IDatastoreService, iamService: IIamService) {
    this._datastoreService = datastoreService;
    this._iamService = iamService;
  }

  private get datastoreService(): IDatastoreService {
    return this._datastoreService;
  }

  private get iamService(): IIamService {
    return this._iamService;
  }

  public async saveDefinitions(definitions: Definitions): Promise<void> {

    const processEntityType = await this.datastoreService.getEntityType('Process');
    const context = await this.iamService.createInternalContext('process_engine');
    
    for (const process of definitions.processes) {

      const processData: any = {
        processId: process.id,
        name: process.name,
        isExecutable: process.isExecutable,
        process: process,
      };

      const processEntity = await processEntityType.createEntity(context, processData);

      await processEntity.save(context);
    }
  }

  public async getProcess(processId: string): Promise<Model.Types.Process> {

    const processEntityType = await this.datastoreService.getEntityType('Process');
    const context = await this.iamService.createInternalContext('process_engine');
    
    const processEntity = await processEntityType.getById(processId, context);

    return processEntity.process;
  }

  public async saveProcessInstance(processInstance: Runtime.Types.ProcessInstance): Promise<void> {
    return;
  }

  public async saveProcessToken(processToken: Runtime.Types.ProcessToken): Promise<void> {
    return;
  }
}