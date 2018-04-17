import { ExecutionContext } from "@essential-projects/core_contracts";
import { IProcessDefEntity, INodeDefEntity, BpmnType, IProcessTokenEntity, IProcessEntity } from '@process-engine/process_engine_contracts';
import { IExecuteProcessService } from "./iexecute_process_service";
import { IFlowNodeHandlerFactory } from "./handler/iflow_node_handler_factory";
import { NextFlowNodeInfo } from "./next_flow_node_info";
import { IDatastoreService } from "@essential-projects/data_model_contracts";
import { IDataMessage, IMessageBusService } from "@essential-projects/messagebus_contracts";

export class ExecuteProcessService implements IExecuteProcessService {

    private flowNodeHandlerFactory: IFlowNodeHandlerFactory = undefined;
    private datastoreService: IDatastoreService = undefined;
    private messageBusService: IMessageBusService;

    constructor(flowNodeHandlerFactory: IFlowNodeHandlerFactory, datastoreService: IDatastoreService, messageBusService: IMessageBusService) {
        this.flowNodeHandlerFactory = flowNodeHandlerFactory;
        this.datastoreService = datastoreService;
        this.messageBusService = messageBusService;
    }

    public async start(context: ExecutionContext, processDefinition: IProcessDefEntity, processInstance: IProcessEntity): Promise<void> {
        await processInstance.initializeProcess();
        const startEvent: INodeDefEntity = await this.getStartEventDef(context, processDefinition);

        const processToken: IProcessTokenEntity = await this.createProcessToken(context);
        await this.executeFlowNode(startEvent, processToken, context);

        await this.end(processInstance, processToken, context);
    }

    private async getStartEventDef(context: ExecutionContext, processDefinition: IProcessDefEntity): Promise<INodeDefEntity> {

        const startEventDef: INodeDefEntity = processDefinition.nodeDefCollection.data.find((nodeDef: INodeDefEntity) => {
            return nodeDef.type === BpmnType.startEvent;
        });
  
        return startEventDef;
    }

    private async executeFlowNode(flowNode: INodeDefEntity, processToken: IProcessTokenEntity, context: ExecutionContext): Promise<void> {
        const flowNodeHandler = this.flowNodeHandlerFactory.create(flowNode.type);

        const nextFlowNodeInfo: NextFlowNodeInfo = await flowNodeHandler.execute(flowNode, processToken, context);

        if (nextFlowNodeInfo.flowNode !== null) {
            await this.executeFlowNode(nextFlowNodeInfo.flowNode, nextFlowNodeInfo.processToken, context);
        }
    }

    private async end(processInstance: IProcessEntity, processToken: IProcessTokenEntity, context: ExecutionContext): Promise<void> {
        const processEndMessageData: any = {
            event: 'end',
            token: processToken.data.current,
        };
    
        const processEndMessage: IDataMessage = this.messageBusService.createDataMessage(processEndMessageData, context);
        this.messageBusService.publish(`/processengine/process/${processInstance.id}`, processEndMessage);
    }

    private async createProcessToken(context: ExecutionContext): Promise<IProcessTokenEntity> {
        
        const processTokenType = await this.datastoreService.getEntityType<IProcessTokenEntity>('ProcessToken');
        
        return processTokenType.createEntity(context);
    }
}