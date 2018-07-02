import {
  Definitions,
  IExecutionContextFacade,
  IIamFacadeFactory,
  IProcessModelPersistenceRepository,
  IProcessModelPersistenceService,
  Model,
} from '@process-engine/process_engine_contracts';

export class ProcessModelPersistenceService implements IProcessModelPersistenceService {

  private _processModelPersistenceRepository: IProcessModelPersistenceRepository;
  private _iamFacadeFactory: IIamFacadeFactory;

  constructor(processModelPersistenceRepository: IProcessModelPersistenceRepository, iamFacadeFactory: IIamFacadeFactory) {
    this._processModelPersistenceRepository = processModelPersistenceRepository;
    this._iamFacadeFactory = iamFacadeFactory;
  }

  private get processModelPersistenceRepository(): IProcessModelPersistenceRepository {
    return this._processModelPersistenceRepository;
  }

  private get iamFacadeFactory(): IIamFacadeFactory {
    return this._iamFacadeFactory;
  }

  public async persistProcessDefinitions(executionContextFacade: IExecutionContextFacade, definitions: Definitions): Promise<void> {
    return this.processModelPersistenceRepository.persistProcessDefinitions(definitions);
  }

  public async getProcessModelById(executionContextFacade: IExecutionContextFacade, processModelId: string): Promise<Model.Types.Process> {
    return this.processModelPersistenceRepository.getProcessModelById(processModelId);
  }

  public async getProcessModels(executionContextFacade: IExecutionContextFacade): Promise<Array<Model.Types.Process>> {
    return this.processModelPersistenceRepository.getProcessModels();
  }
}
