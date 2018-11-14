import {IExternalTaskRepository} from '@process-engine/external_task_api_contracts';
import {
  ICorrelationService,
  IDeleteProcessModelService,
  IFlowNodeInstanceService,
  IProcessModelService,
} from '@process-engine/process_engine_contracts';

export class DeleteProcessModelService implements IDeleteProcessModelService {

  private readonly _correlationService: ICorrelationService;
  private readonly _externalTaskRepository: IExternalTaskRepository;
  private readonly _flowNodeInstanceService: IFlowNodeInstanceService;
  private readonly _processModelService: IProcessModelService;

  constructor(correlationService: ICorrelationService,
              externalTaskRepository: IExternalTaskRepository,
              flowNodeInstanceService: IFlowNodeInstanceService,
              processModelService: IProcessModelService) {

    this._correlationService = correlationService;
    this._externalTaskRepository = externalTaskRepository;
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._processModelService = processModelService;
  }

  public async deleteProcessModel(processModelId: string): Promise<void> {
    await this._processModelService.deleteProcessDefinitionById(processModelId);
    await this._correlationService.deleteCorrelationByProcessModelId(processModelId);
    await this._flowNodeInstanceService.deleteByProcessModelId(processModelId);
    await this._externalTaskRepository.deleteExternalTasksByProcessModelId(processModelId);
  }
}
