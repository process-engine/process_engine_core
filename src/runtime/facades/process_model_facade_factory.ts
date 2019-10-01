import {Model} from '@process-engine/persistence_api.contracts';
import {IProcessModelFacade, IProcessModelFacadeFactory} from '@process-engine/process_engine_contracts';

import {ProcessModelFacade} from './process_model_facade';

export class ProcessModelFacadeFactory implements IProcessModelFacadeFactory {

  public create(processModel: Model.Process): IProcessModelFacade {
    return new ProcessModelFacade(processModel);
  }

}
