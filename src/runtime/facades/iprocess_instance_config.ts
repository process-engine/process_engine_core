import {FlowNodeInstance} from '@process-engine/flow_node_instance.contracts';
import {IProcessModelFacade, IProcessTokenFacade, ProcessToken} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

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
