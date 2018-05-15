import { ExecutionContext } from "@essential-projects/core_contracts";
import { NextFlowNodeInfo } from "../next_flow_node_info";
import { IFlowNodeHandlerFactory } from "./iflow_node_handler_factory";
import { IDatastoreService } from "@essential-projects/data_model_contracts";
import { Model, Runtime, BpmnType } from '@process-engine/process_engine_contracts';
import {IProcessModelFascade} from './../index';

export class ParallelGatewayHandler {
    private flowNodeHandlerFactory: IFlowNodeHandlerFactory
    private datastoreService: IDatastoreService;

    constructor(flowNodeHandlerFactory: IFlowNodeHandlerFactory, datastoreService: IDatastoreService) {
        this.flowNodeHandlerFactory = flowNodeHandlerFactory;
        this.datastoreService = datastoreService;
    }

    protected async executeIntern(flowNode: Model.Base.FlowNode, processToken: Runtime.Types.ProcessToken, processModelFascade: IProcessModelFascade, context: ExecutionContext): Promise<NextFlowNodeInfo>  {

        const incomingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFascade.getIncomingSequenceFlowsFor(flowNode.id);
        const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFascade.getOutgoingSequenceFlowsFor(flowNode.id);

        // TODO: Robin: is this comparison really appropriate?
        if (incomingSequenceFlows.length < outgoingSequenceFlows.length) {
            const joinGateway: Model.Base.FlowNode = await this._findJoinGateway(flowNode, processModelFascade);

            const promises: Array<Promise<NextFlowNodeInfo>> = outgoingSequenceFlows.map(async (outgoingSequenceFlow: Model.Types.SequenceFlow) => {

                const processTokenForBranch = await this._createProcessTokenForParallelBranch(context);
                const nextFlowNodeInBranch = processModelFascade.getFlowNodeById(outgoingSequenceFlow.targetRef);

                return await this._executeBranchToJoinGateway(nextFlowNodeInBranch, processTokenForBranch, context, joinGateway);
            });


            const nextFlowNodeInfos: Array<NextFlowNodeInfo> = await Promise.all(promises);
            for (const nextFlowNodeInfo of nextFlowNodeInfos) {
                this._mergeTokenHistory(processToken, nextFlowNodeInfo.processToken);
            }

            const nextFlowNode: Model.Base.FlowNode = await processModelFascade.getNextFlowNodeFor(joinGateway);

            return new NextFlowNodeInfo(nextFlowNode, processToken);
        } else {
            return null;
        }
    }

    // TODO: support of new Split Gateway in Branch
    private async _findJoinGateway(flowNode: Model.Base.FlowNode, processModelFascade: IProcessModelFascade): Promise<Model.Base.FlowNode> {
        
        const incomingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFascade.getIncomingSequenceFlowsFor(flowNode.id);
        const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFascade.getOutgoingSequenceFlowsFor(flowNode.id);
        
        const isFlowNodeParallelGateway: boolean = flowNode instanceof Model.Gateways.ParallelGateway;

        if (isFlowNodeParallelGateway && incomingSequenceFlows.length > outgoingSequenceFlows.length) {
            return flowNode;
        } else {
            const nextFlowNode: Model.Base.FlowNode = await processModelFascade.getNextFlowNodeFor(flowNode);
            return this._findJoinGateway(nextFlowNode, processModelFascade);
        }
    }

    private async _executeBranchToJoinGateway(flowNode: Model.Base.FlowNode, processToken: IProcessTokenEntity, context: ExecutionContext, joinGateway: INodeDefEntity): Promise<NextFlowNodeInfo> {
        const flowNodeHandler = this.flowNodeHandlerFactory.create(flowNode.type);

        const nextFlowNodeInfo: NextFlowNodeInfo = await flowNodeHandler.execute(flowNode, processToken, context);
        
        if (nextFlowNodeInfo.flowNode !== null && nextFlowNodeInfo.flowNode.id !== joinGateway.id) {
            return this._executeBranchToJoinGateway(nextFlowNodeInfo.flowNode, nextFlowNodeInfo.processToken, context, joinGateway);
        }

        return new NextFlowNodeInfo(joinGateway, processToken);
    }

    private async _createProcessTokenForParallelBranch(context: ExecutionContext): Promise<IProcessTokenEntity> {
        
        const processTokenType = await this.datastoreService.getEntityType<IProcessTokenEntity>('ProcessToken');
        
        return processTokenType.createEntity(context);
    }
    
    private async _mergeTokenHistory(processToken: IProcessTokenEntity, tokenWithHistoryToMerge: IProcessTokenEntity): void {
        const gatewayToken: IProcessTokenEntity = processToken;
        if (gatewayToken.data === undefined) {
          gatewayToken.data = {};
        }
    
        if (gatewayToken.data.history === undefined) {
          gatewayToken.data.history = {};
        }
    
        gatewayToken.data.history = {
          ...gatewayToken.data.history,
          ...tokenWithHistoryToMerge.data.history,
        };
      }
}