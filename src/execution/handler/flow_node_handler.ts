import { IFlowNodeHandler } from ".";
import { INodeDefEntity, IProcessTokenEntity, IProcessDefEntity, IFlowDefEntity } from "@process-engine/process_engine_contracts";
import { ExecutionContext } from "@essential-projects/core_contracts";
import { NextFlowNodeInfo } from "..";

export abstract class FlowNodeHandler implements IFlowNodeHandler {

    public async execute(flowNode: INodeDefEntity, processToken: IProcessTokenEntity, context: ExecutionContext): Promise<NextFlowNodeInfo> {
        const nextFlowNode = await this.executeIntern(flowNode, processToken, context);
        await this.afterExecute(flowNode, processToken, context);

        return nextFlowNode;
    }

    protected async abstract executeIntern(flowNode: INodeDefEntity, processToken: IProcessTokenEntity, context: ExecutionContext): Promise<NextFlowNodeInfo>;

    protected async getNextFlowNodeFor(flowNode: INodeDefEntity, context: ExecutionContext): Promise<INodeDefEntity> {
        const processDefinition: IProcessDefEntity = await flowNode.getProcessDef(context);
        const nextFlowNodeId: string = await this.getNextFlowNodeId(flowNode.id, processDefinition, context);

        return this.getFlowNodeById(nextFlowNodeId, processDefinition);
    }

    protected getFlowNodeById(flowNodeId: string, processDefinition: IProcessDefEntity): INodeDefEntity {
        const nextFlowNode: INodeDefEntity = processDefinition.nodeDefCollection.data.find((currentFlowNode: INodeDefEntity) => {
            return currentFlowNode.id === flowNodeId;
        });

        return nextFlowNode;
    }

    private async getNextFlowNodeId(flowNodeId: string, processDefinition: IProcessDefEntity, context: ExecutionContext): Promise<string> {

        const flow: IFlowDefEntity = processDefinition.flowDefCollection.data.find((sequenceFlow: IFlowDefEntity) => {
            return sequenceFlow.source.id === flowNodeId;
        });

        if (flow === undefined) {
            return null;
        }

        return flow.target.id;
    }

    private async afterExecute(flowNode: INodeDefEntity, processToken: IProcessTokenEntity, context: ExecutionContext): Promise<void> {
            const tokenData = processToken.data || {};
            const mapper = flowNode.mapper;
            const processDefinition = await flowNode.getProcessDef(context);
        
            if (mapper !== undefined) {
              const newCurrent = (new Function('token', 'return ' + mapper)).call(tokenData, tokenData);
              tokenData.current = newCurrent;
            }
        
            tokenData.history = tokenData.history || {};

            if (!tokenData.history[flowNode.key]) {
                tokenData.history[flowNode.key] = tokenData.current;
            } else {
                if (!Array.isArray(tokenData.history[flowNode.key])) {
                    tokenData.history[flowNode.key] = [tokenData.history[flowNode.key]];
                } 

                tokenData.history[flowNode.key].push(tokenData.current);
            }
        
            processToken.data = tokenData;
        
            if (processDefinition.persist) {
              await processToken.save(context, { reloadAfterSave: false });
            }
    }
}