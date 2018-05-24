import { INodeDefEntity, IProcessTokenEntity } from '@process-engine/process_engine_contracts';
import { Model, Runtime } from '@process-engine/process_engine_contracts';
import { IProcessTokenFascade } from '../index';

export class NextFlowNodeInfo {

  public flowNode: Model.Base.FlowNode;
  public processTokenFascade: IProcessTokenFascade;

  constructor(flowNode: Model.Base.FlowNode, processTokenFascade: IProcessTokenFascade) {
    this.flowNode = flowNode;
    this.processTokenFascade = processTokenFascade;
  }

}
