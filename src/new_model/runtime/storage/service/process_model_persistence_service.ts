import {Definitions, IIamFacadeFactory, IProcessModelPersistence, Model} from '@process-engine/process_engine_contracts';

export class ProcessModelPersistenceService implements IProcessModelPersistence {

  private _processModelPersistenceRepository: IProcessModelPersistence;
  private _iamFacadeFactory: IIamFacadeFactory;

  constructor(processModelPersistenceRepository: IProcessModelPersistence, iamFacadeFactory: IIamFacadeFactory) {
    this._processModelPersistenceRepository = processModelPersistenceRepository;
    this._iamFacadeFactory = iamFacadeFactory;
  }

  private get processModelPersistenceRepository(): IProcessModelPersistence {
    return this._processModelPersistenceRepository;
  }

  private get iamFacadeFactory(): IIamFacadeFactory {
    return this._iamFacadeFactory;
  }

  public async persistProcessDefinitions(definitions: Definitions): Promise<void> {
    return this.processModelPersistenceRepository.persistProcessDefinitions(definitions);
  }

  public async getProcessModelById(processModelId: string): Promise<Model.Types.Process> {
    return this.processModelPersistenceRepository.getProcessModelById(processModelId);
  }

  public async getProcessModels(): Promise<Array<Model.Types.Process>> {
    return this.processModelPersistenceRepository.getProcessModels();
  }
}
