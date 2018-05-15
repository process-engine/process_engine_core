import { IFlowNodeHandler, NextFlowNodeInfo, IProcessModelFascade, IProcessEngineStorageService, IFlowNodeHandlerFactory } from './../index';
import { Model, Runtime, BpmnType } from "@process-engine/process_engine_contracts";
import { ExecutionContext } from "@essential-projects/core_contracts";
import { IProcessTokenFascade } from '../process_token_fascade';

export abstract class FlowNodeHandler<TFlowNode extends Model.Base.FlowNode> implements IFlowNodeHandler<TFlowNode> {

    constructor() {
    }

    public async execute(flowNode: TFlowNode, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo> {
        const nextFlowNode = await this.executeIntern(flowNode, processTokenFascade, processModelFascade);
        await this.afterExecute(flowNode, processTokenFascade, processModelFascade);

        return nextFlowNode;
    }

    protected async abstract executeIntern(flowNode: TFlowNode, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo>;

    // protected async getNextFlowNodeFor(flowNode: Model.Base.FlowNode, context: ExecutionContext): Promise<Model.Base.FlowNode> {
        

    //     const processDefinition: Model.Types.Process = await flowNode.getProcessDef(context);
    //     const nextFlowNodeId: string = await this.getNextFlowNodeId(flowNode.id, processDefinition, context);

    //     return this.getFlowNodeById(nextFlowNodeId, processDefinition);
    // }

    // protected getFlowNodeById(flowNodeId: string, processDefinition: Model.Types.Process): Model.Base.FlowNode {
    //     const nextFlowNode: Model.Base.FlowNode = processDefinition.nodeDefCollection.data.find((currentFlowNode: Model.Base.FlowNode) => {
    //         return currentFlowNode.id === flowNodeId;
    //     });

    //     return nextFlowNode;
    // }

    // private async getNextFlowNodeId(flowNodeId: string, processDefinition: Model.Types.Process, context: ExecutionContext): Promise<string> {

    //     const flow: IFlowDefEntity = processDefinition.flowDefCollection.data.find((sequenceFlow: IFlowDefEntity) => {
    //         return sequenceFlow.source.id === flowNodeId;
    //     });

    //     if (flow === undefined) {
    //         return null;
    //     }

    //     return flow.target.id;
    // }

    private async afterExecute(flowNode: TFlowNode, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<void> {
        
        // processTokenFascade.resolveMapper()

        // const tokenData = processToken.data || {};
        // const mapper: string = (flowNode as any).mapper;
    
        // if (mapper !== undefined) {
        //     const newCurrent = (new Function('token', 'return ' + mapper)).call(tokenData, tokenData);
        //     tokenData.current = newCurrent;
        // }
    
        // tokenData.history = tokenData.history || {};

        // if (!tokenData.history[flowNode.id]) {
        //     tokenData.history[flowNode.id] = tokenData.current;
        // } else {
        //     if (!Array.isArray(tokenData.history[flowNode.id])) {
        //         tokenData.history[flowNode.id] = [tokenData.history[flowNode.id]];
        //     } 

        //     tokenData.history[flowNode.id].push(tokenData.current);
        // }
    
        // processToken.data = tokenData;

        // await this.processEngineStorageService.saveProcessToken(processToken);
    }
}