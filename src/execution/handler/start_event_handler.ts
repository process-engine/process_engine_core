import { FlowNodeHandler, NextFlowNodeInfo, IProcessModelFascade, IProcessTokenFascade } from './../index';
import { Model, Runtime } from "@process-engine/process_engine_contracts";
import { ExecutionContext } from "@essential-projects/core_contracts";

export class StartEventHandler extends FlowNodeHandler<Model.Events.StartEvent> {
    
    protected async executeIntern(flowNode: Model.Events.StartEvent, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo> {
        const nextFlowNode: Model.Base.FlowNode = await processModelFascade.getNextFlowNodeFor(flowNode);
        return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);
    }
}