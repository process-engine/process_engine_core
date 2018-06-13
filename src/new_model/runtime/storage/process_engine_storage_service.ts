import { IIamService, IPrivateQueryOptions } from '@essential-projects/core_contracts';
import { IDatastoreService } from '@essential-projects/data_model_contracts';
import { Definitions, IProcessEngineStorageService, Model, Runtime } from '@process-engine/process_engine_contracts';

export class ProcessEngineStorageService implements IProcessEngineStorageService {

  private _datastoreService: IDatastoreService = undefined;
  private _iamService: IIamService = undefined;
  private _definitions: Array<Definitions> = [];
  private _instances: Array<Runtime.Types.ProcessInstance> = [];

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

  private get definitions(): Array<Definitions> {
    return this._definitions;
  }

  private get instances(): Array<Runtime.Types.ProcessInstance> {
    return this._instances;
  }

  public async saveProcessInstance(processInstance: Runtime.Types.ProcessInstance): Promise<void> {
    this.instances.push(processInstance);
  }

  public async saveDefinitions(definitions: Definitions): Promise<void> {

    this.definitions.push(definitions);

    // TODO: rename this - ProcessEntity is already present in the old model
    // const processEntityType = await this.datastoreService.getEntityType('BpmnProcess');
    // const context = await this.iamService.createInternalContext('processengine_system');

    // for (const process of definitions.processes) {

    //   const processData: any = {
    //     processId: process.id,
    //     name: process.name,
    //     isExecutable: process.isExecutable,
    //     process: process,
    //   };

    //   const processEntity = await processEntityType.createEntity(context, processData);

    //   await processEntity.save(context);
    // }

  }

  public async getProcessInstancesForCorrelation(correlationId: string): Promise<Array<Runtime.Types.ProcessInstance>> {
    const processInstancesForCorrelation: Array<Runtime.Types.ProcessInstance> = this.instances.filter((processInstance: Runtime.Types.ProcessInstance) => {
      return processInstance.correlationId === correlationId;
    });

    return processInstancesForCorrelation;
  }

  public async getProcess(processId: string): Promise<Model.Types.Process> {

    for (const definition of this._definitions) {

      for (const process of definition.processes) {

       if (process.id === processId) {
          return process;
        }
      }
    }
  }
}
