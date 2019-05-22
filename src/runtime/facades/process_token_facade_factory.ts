import {IIdentity} from '@essential-projects/iam_contracts';
import {IProcessTokenFacade, IProcessTokenFacadeFactory} from '@process-engine/process_engine_contracts';
import {ProcessTokenFacade} from './process_token_facade';

export class ProcessTokenFacadeFactory implements IProcessTokenFacadeFactory {

  public create(processInstanceId: string, processModelId: string, correlationId: string, identity: IIdentity): IProcessTokenFacade {
    return new ProcessTokenFacade(processInstanceId, processModelId, correlationId, identity);
  }

}
