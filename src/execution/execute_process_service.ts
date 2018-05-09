import { ExecutionContext } from '@essential-projects/core_contracts';
import { IDatastoreService } from '@essential-projects/data_model_contracts';
import { IDataMessage, IMessageBusService } from '@essential-projects/messagebus_contracts';
import { Model, Runtime } from '@process-engine/process_engine_contracts';
import { IFlowNodeHandler } from '.';
import { IFlowNodeHandlerFactory } from './handler/iflow_node_handler_factory';
import { IExecuteProcessService } from './iexecute_process_service';
import { NextFlowNodeInfo } from './next_flow_node_info';

import * as uuid from 'uuid';

export class ExecuteProcessService implements IExecuteProcessService {

    private flowNodeHandlerFactory: IFlowNodeHandlerFactory = undefined;
    private datastoreService: IDatastoreService = undefined;
    private messageBusService: IMessageBusService;

    constructor(flowNodeHandlerFactory: IFlowNodeHandlerFactory, datastoreService: IDatastoreService, messageBusService: IMessageBusService) {
        this.flowNodeHandlerFactory = flowNodeHandlerFactory;
        this.datastoreService = datastoreService;
        this.messageBusService = messageBusService;
    }

    public async start(context: ExecutionContext, processDefinition: Model.Types.Process): Promise<void> {

        const startEvent: Model.Events.StartEvent = await this._getStartEventDef(context, processDefinition);

        const processInstance: Runtime.Types.ProcessInstance = this._createProcessInstance(processDefinition);

        const processToken: Runtime.Types.ProcessToken = await this._createProcessToken(context);
        await this._executeFlowNode(startEvent, processToken, context);

        await this._end(processInstance, processToken, context);
    }

    private _createProcessInstance(processDefinition: Model.Types.Process): Runtime.Types.ProcessInstance {
        const processInstance: Runtime.Types.ProcessInstance = new Runtime.Types.ProcessInstance();
        processInstance.processInstanceId = uuid.v4();
        return processInstance;
    }

    private _getStartEventDef(context: ExecutionContext, processDefinition: Model.Types.Process): Promise<Model.Events.StartEvent> {

        const startEventDef: Model.Base.FlowNode = processDefinition.flowNodes.find((nodeDef: Model.Base.FlowNode) => {
            return nodeDef.constructor.name === 'StartEvent';
        });

        return startEventDef as Model.Events.StartEvent;
    }

    private async _executeFlowNode(flowNode: Model.Base.FlowNode, processToken: Runtime.Types.ProcessToken, context: ExecutionContext): Promise<void> {
        const flowNodeHandler: IFlowNodeHandler = this.flowNodeHandlerFactory.create(flowNode.type);

        const nextFlowNodeInfo: NextFlowNodeInfo = await flowNodeHandler.execute(flowNode, processToken, context);

        if (nextFlowNodeInfo.flowNode !== null) {
            await this._executeFlowNode(nextFlowNodeInfo.flowNode, nextFlowNodeInfo.processToken, context);
        }
    }

    private async _end(processInstance: Runtime.Types.ProcessInstance, processToken: Runtime.Types.ProcessToken, context: ExecutionContext): Promise<void> {
        const processEndMessageData: any = {
            event: 'end',
            token: processToken.data.current,
        };

        const processEndMessage: IDataMessage = this.messageBusService.createDataMessage(processEndMessageData, context);
        this.messageBusService.publish(`/processengine/process/${processInstance.processInstanceId}`, processEndMessage);
    }

    private async _createProcessToken(context: ExecutionContext): Promise<Runtime.Types.ProcessToken> {
        return new Runtime.Types.ProcessToken();
    }
}
