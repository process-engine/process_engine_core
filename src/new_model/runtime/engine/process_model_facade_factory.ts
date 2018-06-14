import {IProcessModelFactory, IProcessModelFacade, Model} from '@process-engine/process_engine_contracts';
import {ProcessModelFacade} from './process_model_facade';

export class ProcessModelFactory implements IProcessModelFactory {
  public create(processModel: Model.Types.Process): IProcessModelFacade {
    return new ProcessModelFacade(processModel);
  }
}