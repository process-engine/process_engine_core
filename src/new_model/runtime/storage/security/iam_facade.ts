import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';
import {IIamFacade} from '@process-engine/process_engine_contracts';

export class IamFacade implements IIamFacade {

  private _iamService: IIAMService;

  constructor(iamService: IIAMService) {
    this._iamService = iamService;
  }

  private get iamService(): IIAMService {
    return this._iamService;
  }

  public async checkIfUserCanAccessLane(identity: IIdentity, laneId: string): Promise<boolean> {
    return Promise.resolve(true);
  }

}
