import {ExecutionContext, IExecutionContextFacade, IExecutionContextFacadeFactory} from '@process-engine/process_engine_contracts';

import {ExecutionContextFacade} from './execution_context_facade';

export class ExecutionContextFacadeFactory implements IExecutionContextFacadeFactory {
  public create(executionContext: ExecutionContext): IExecutionContextFacade {
    return new ExecutionContextFacade(executionContext);
  }
}
