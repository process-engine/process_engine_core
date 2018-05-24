import { ExecutionContext } from '@essential-projects/core_contracts';
import { IProcessDefEntity, IProcessEntity, Model } from '@process-engine/process_engine_contracts';

export interface IExecuteProcessService {
  start(context: ExecutionContext, processDefinition: Model.Types.Process, initialToken?: any): Promise<void>;
}
