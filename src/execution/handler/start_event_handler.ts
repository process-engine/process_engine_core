import { FlowNodeHandler, NextFlowNodeInfo, IProcessModelFascade, IProcessEngineStorageService } from './../index';
import { Model, Runtime } from "@process-engine/process_engine_contracts";
import { ExecutionContext } from "@essential-projects/core_contracts";

export class StartEventHandler extends FlowNodeHandler {
    
    protected async executeIntern(flowNode: Model.Base.FlowNode, processToken: Runtime.Types.ProcessToken, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo> {
        const nextFlowNode: Model.Base.FlowNode = await processModelFascade.getNextFlowNodeFor(flowNode);
        return new NextFlowNodeInfo(nextFlowNode, processToken);
    }
}