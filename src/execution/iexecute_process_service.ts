import { ExecutionContext } from "@essential-projects/core_contracts";
import { IProcessDefEntity, IProcessEntity } from '@process-engine/process_engine_contracts';
import { Model } from '@process-engine/process_engine_contracts';

export interface IExecuteProcessService {
    start(context: ExecutionContext, processDefinition: Model.Types.Process): void;
}