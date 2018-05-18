import { ExecutionContext } from '@essential-projects/core_contracts';
import { IDatastoreService } from '@essential-projects/data_model_contracts';
import { IDataMessage, IMessageBusService } from '@essential-projects/messagebus_contracts';
import { Model, Runtime } from '@process-engine/process_engine_contracts';
import { IFlowNodeHandler, ProcessTokenFascade } from '.';
import { IFlowNodeHandlerFactory } from './handler/iflow_node_handler_factory';
import { IExecuteProcessService } from './iexecute_process_service';
import { NextFlowNodeInfo } from './next_flow_node_info';

import * as uuid from 'uuid';
import { IProcessModelFascade, IProcessTokenFascade, ProcessModelFascade } from './index';

export class ExecuteProcessService implements IExecuteProcessService {

    private flowNodeHandlerFactory: IFlowNodeHandlerFactory = undefined;
    private datastoreService: IDatastoreService = undefined;
    private messageBusService: IMessageBusService;

    constructor(flowNodeHandlerFactory: IFlowNodeHandlerFactory, datastoreService: IDatastoreService, messageBusService: IMessageBusService) {
        this.flowNodeHandlerFactory = flowNodeHandlerFactory;
        this.datastoreService = datastoreService;
        this.messageBusService = messageBusService;
    }

    public async start(context: ExecutionContext, process: Model.Types.Process, initialToken?: any): Promise<any> {

        const processModelFascade: IProcessModelFascade = new ProcessModelFascade(process);

        const startEvent: Model.Events.StartEvent = processModelFascade.getStartEvent();

        const processInstance: Runtime.Types.ProcessInstance = this._createProcessInstance(process);

        const processToken: Runtime.Types.ProcessToken = this._createProcessToken(context);
        const processTokenFascade: IProcessTokenFascade = new ProcessTokenFascade(processToken);

        processTokenFascade.addResultForFlowNode(startEvent.id, initialToken);

        await this._executeFlowNode(startEvent, processTokenFascade, processModelFascade);

        const resultToken: any = await processTokenFascade.getOldTokenFormat();

        return resultToken.current;
        // await this._end(processInstance, resultToken, context);
    }

    private _createProcessInstance(processDefinition: Model.Types.Process): Runtime.Types.ProcessInstance {
        const processInstance: Runtime.Types.ProcessInstance = new Runtime.Types.ProcessInstance();
        processInstance.processInstanceId = uuid.v4();
        return processInstance;
    }

    private async _executeFlowNode(flowNode: Model.Base.FlowNode, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<void> {

        const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFascade);

        const nextFlowNodeInfo: NextFlowNodeInfo = await flowNodeHandler.execute(flowNode, processTokenFascade, processModelFascade);

        if (nextFlowNodeInfo.flowNode !== null) {
            await this._executeFlowNode(nextFlowNodeInfo.flowNode, nextFlowNodeInfo.processTokenFascade, processModelFascade);
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

    private _createProcessToken(context: ExecutionContext): Runtime.Types.ProcessToken {
        return new Runtime.Types.ProcessToken();
    }
}
