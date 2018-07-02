import {IIAMService} from '@essential-projects/iam_contracts';
import {IExecutionContextFacade, IIamFacade, IIamFacadeFactory, Model} from '@process-engine/process_engine_contracts';

import {IamFacade} from './iam_facade';

export class IamFacadeFactory implements IIamFacadeFactory {

  private _iamService: IIAMService;

  constructor(iamService: IIAMService) {
    this._iamService = iamService;
  }

  public create(executionContextFacade: IExecutionContextFacade, processModel: Model.Types.Process): IIamFacade {
    return new IamFacade(executionContextFacade, this._iamService, processModel);
  }
}
