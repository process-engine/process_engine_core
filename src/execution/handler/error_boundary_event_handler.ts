import { FlowNodeHandler } from "./flow_node_handler";
import { INodeDefEntity, IProcessTokenEntity, IBoundaryEventEntity } from "@process-engine/process_engine_contracts";
import { ExecutionContext } from "@essential-projects/core_contracts";
import { NextFlowNodeInfo } from "../next_flow_node_info";

export class ErrorBoundaryEventHandler extends FlowNodeHandler {
    private activityHandler: FlowNodeHandler;

    constructor(activityHandler: FlowNodeHandler) {
        super();
        this.activityHandler = activityHandler;
    }

    protected async executeIntern(flowNode: INodeDefEntity, processToken: IProcessTokenEntity, context: ExecutionContext): Promise<NextFlowNodeInfo> {
        try
        {
            const nextFlowNodeInfo: NextFlowNodeInfo = await this.activityHandler.execute(flowNode, processToken, context);

            return nextFlowNodeInfo;
        } catch (err) {
            const boundaryEvent: IBoundaryEventEntity = flowNode.getBoundaryEvents(context)[0];

            return new NextFlowNodeInfo(await this.getNextFlowNodeFor(boundaryEvent.nodeDef, context), processToken); 
        }
    }
}