import {IProcessModelFacade, IProcessModelFacadeFactory, Model} from '@process-engine/process_engine_contracts';
import {ProcessModelFacade} from './process_model_facade';

export class ProcessModelFacadeFactory implements IProcessModelFacadeFactory {
  public create(processModel: Model.Types.Process): IProcessModelFacade {
    return new ProcessModelFacade(processModel);
  }
}
