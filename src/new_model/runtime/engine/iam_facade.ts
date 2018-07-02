import {IIAMService} from '@essential-projects/iam_contracts';
import {IExecutionContextFacade, IIamFacade, Model} from '@process-engine/process_engine_contracts';

export class IamFacade implements IIamFacade {

  private _executionContextFacade: IExecutionContextFacade;
  private _iamService: IIAMService;
  private _processModel: Model.Types.Process;

  constructor(executionContextFacade: IExecutionContextFacade, iamService: IIAMService, processModel: Model.Types.Process) {
    this._executionContextFacade = executionContextFacade;
    this._iamService = iamService;
    this._processModel = processModel;
  }

  private get executionContextFacade(): IExecutionContextFacade {
    return this._executionContextFacade;
  }

  private get iamService(): IIAMService {
    return this._iamService;
  }

  private get iamSprocessModelervice(): Model.Types.Process {
    return this._processModel;
  }

  public async checkIfUserCanAccessLane(laneId: string): Promise<boolean> {
    return Promise.resolve(true);
  }

}
