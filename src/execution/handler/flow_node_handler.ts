import { ExecutionContext } from '@essential-projects/core_contracts';
import { BpmnType, Model, Runtime } from '@process-engine/process_engine_contracts';
import { IProcessTokenFascade } from '../index';
import { IFlowNodeHandler, IFlowNodeHandlerFactory, IProcessModelFascade, NextFlowNodeInfo } from './../index';

export abstract class FlowNodeHandler<TFlowNode extends Model.Base.FlowNode> implements IFlowNodeHandler<TFlowNode> {

    constructor() {
    }

    public async execute(flowNode: TFlowNode, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo> {

        let nextFlowNode: NextFlowNodeInfo;

        try {
            nextFlowNode = await this.executeIntern(flowNode, processTokenFascade, processModelFascade);
        } catch (error) {
            // TODO: (SM) this is only to support the old implementation
            //            I would like to set no token result or further specify it to be an error to avoid confusion
            await processTokenFascade.addResultForFlowNode(flowNode.id, error);
        }

        await this.afterExecute(flowNode, nextFlowNode.flowNode, processTokenFascade, processModelFascade);

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

    private async afterExecute(flowNode: TFlowNode, nextFlowNode: Model.Base.FlowNode, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<void> {

        const nextSequenceFlow: Model.Types.SequenceFlow = processModelFascade.getSequenceFlowBetween(flowNode, nextFlowNode);

        if (!nextSequenceFlow) {
            return;
        }

        await processTokenFascade.evaluateMapper(nextSequenceFlow);
        // const tokenData: any = await processTokenFascade.getOldTokenFormat();

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
