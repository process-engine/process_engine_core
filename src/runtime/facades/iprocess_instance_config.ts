import {FlowNodeInstance, Model} from '@process-engine/persistence_api.contracts';
import {IProcessModelFacade, IProcessTokenFacade, ProcessToken} from '@process-engine/process_engine_contracts';

/**
 * Internal type for storing a config for a new ProcessInstance.
 */
export interface IProcessInstanceConfig {
  correlationId: string;
  processModelId: string;
  processInstanceId: string;
  parentProcessInstanceId?: string;
  processModelFacade: IProcessModelFacade;
  startEvent: Model.Events.StartEvent;
  startEventInstance?: FlowNodeInstance;
  processToken: ProcessToken;
  processTokenFacade: IProcessTokenFacade;
}
