import { GatewayHandler } from "./gateway_handler";
import { INodeDefEntity, IProcessTokenEntity, IFlowDefEntity, IProcessDefEntity, BpmnType } from "@process-engine/process_engine_contracts";
import { ExecutionContext } from "@essential-projects/core_contracts";
import { NextFlowNodeInfo } from "../next_flow_node_info";
import { IFlowNodeHandlerFactory } from "./iflow_node_handler_factory";
import { IDatastoreService } from "@essential-projects/data_model_contracts";

export class ParallelGatewayHandler extends GatewayHandler {
    private flowNodeHandlerFactory: IFlowNodeHandlerFactory
    private datastoreService: IDatastoreService;

    constructor(flowNodeHandlerFactory: IFlowNodeHandlerFactory, datastoreService: IDatastoreService) {
        super();
        this.flowNodeHandlerFactory = flowNodeHandlerFactory;
        this.datastoreService = datastoreService;
    }

    protected async executeIntern(flowNode: INodeDefEntity, processToken: IProcessTokenEntity, context: ExecutionContext): Promise<NextFlowNodeInfo> {
        const processDefinition: IProcessDefEntity = await flowNode.getProcessDef(context);
        const incomingSequenceFlows: IFlowDefEntity[] = this.getIncomingSequenceFlowsFor(flowNode.id, processDefinition);
        const outgoingSequenceFlows: IFlowDefEntity[] = this.getOutgoingSequenceFlowsFor(flowNode.id, processDefinition);

        if (incomingSequenceFlows.length < outgoingSequenceFlows.length) {
            const joinGateway: INodeDefEntity = await this.findJoinGateway(flowNode, processDefinition, context);
            const promises = [];

            for (const outgoingSequenceFlow of outgoingSequenceFlows) {
                const processTokenForBranch = await this.createProcessToken(context);
                const nextFlowNodeInBranch = this.getFlowNodeById(outgoingSequenceFlow.target.id, processDefinition);

                promises.push(this.executeBranchToJoinGateway(nextFlowNodeInBranch, processTokenForBranch, context, joinGateway));
            }

            const nextFlowNodeInfos: NextFlowNodeInfo[] = await Promise.all(promises);
            for (const nextFlowNodeInfo of nextFlowNodeInfos) {
                this.mergeTokenHistory(processToken, nextFlowNodeInfo.processToken);
            }

            return new NextFlowNodeInfo(await this.getNextFlowNodeFor(joinGateway, context), processToken);
        } else {
            return null;
        }
    }

    // TODO: support of new Split Gateway in Branch
    private async findJoinGateway(flowNode: INodeDefEntity, processDefinition: IProcessDefEntity, context: ExecutionContext): Promise<INodeDefEntity> {
        const incomingSequenceFlows: IFlowDefEntity[] = this.getIncomingSequenceFlowsFor(flowNode.id, processDefinition);
        const outgoingSequenceFlows: IFlowDefEntity[] = this.getOutgoingSequenceFlowsFor(flowNode.id, processDefinition);
        
        if (flowNode.type == BpmnType.parallelGateway && incomingSequenceFlows.length > outgoingSequenceFlows.length) {
            return flowNode;
        } else {
            return this.findJoinGateway(await this.getNextFlowNodeFor(flowNode, context), processDefinition, context);
        }
    }

    private async executeBranchToJoinGateway(flowNode: INodeDefEntity, processToken: IProcessTokenEntity, context: ExecutionContext, joinGateway: INodeDefEntity): Promise<NextFlowNodeInfo> {
        const flowNodeHandler = this.flowNodeHandlerFactory.create(flowNode.type);

        const nextFlowNodeInfo: NextFlowNodeInfo = await flowNodeHandler.execute(flowNode, processToken, context);
        
        if (nextFlowNodeInfo.flowNode !== null && nextFlowNodeInfo.flowNode.id !== joinGateway.id) {
            return this.executeBranchToJoinGateway(nextFlowNodeInfo.flowNode, nextFlowNodeInfo.processToken, context, joinGateway);
        }

        return new NextFlowNodeInfo(joinGateway, processToken);
    }

    private async createProcessToken(context: ExecutionContext): Promise<IProcessTokenEntity> {
        
        const processTokenType = await this.datastoreService.getEntityType<IProcessTokenEntity>('ProcessToken');
        
        return processTokenType.createEntity(context);
    }
    
    private mergeTokenHistory(processToken: IProcessTokenEntity, tokenWithHistoryToMerge: IProcessTokenEntity): void {
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