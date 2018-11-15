import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';
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
  private readonly _iamService: IIAMService;
  private readonly _processModelService: IProcessModelService;

  private _canDeleteProcessModel: string = 'can_delete_process_model';

  constructor(correlationService: ICorrelationService,
              externalTaskRepository: IExternalTaskRepository,
              flowNodeInstanceService: IFlowNodeInstanceService,
              iamService: IIAMService,
              processModelService: IProcessModelService) {

    this._correlationService = correlationService;
    this._externalTaskRepository = externalTaskRepository;
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._iamService = iamService;
    this._processModelService = processModelService;
  }

  public async deleteProcessModel(identity: IIdentity, processModelId: string): Promise<void> {
    await this._iamService.ensureHasClaim(identity, this._canDeleteProcessModel);

    await this._processModelService.deleteProcessDefinitionById(processModelId);
    await this._correlationService.deleteCorrelationByProcessModelId(processModelId);
    await this._flowNodeInstanceService.deleteByProcessModelId(processModelId);
    await this._externalTaskRepository.deleteExternalTasksByProcessModelId(processModelId);
  }
}
