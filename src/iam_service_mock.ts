import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';

// TODO: This mock will be removed, when the process engine itself is capable of authenticating itself
// against the external authority.
// Until then, we need this mock for the ProcessEngineService, so that it is able to retrieve a full process model,
// regardless of the requesting users access rights.
// If we didn't have that option, then we would not be able to execute a process instance, since it is very possible
// that the process model we pass to the executeProcessService will be incomplete.
export class IamServiceMock implements IIAMService {

  public async ensureHasClaim(identity: IIdentity, claimName: string): Promise<void> {
    return Promise.resolve();
  }

}
