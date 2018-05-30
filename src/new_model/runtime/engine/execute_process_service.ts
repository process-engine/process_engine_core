import { ExecutionContext } from '@essential-projects/core_contracts';
import { IDatastoreService } from '@essential-projects/data_model_contracts';
import { IDataMessage, IMessageBusService } from '@essential-projects/messagebus_contracts';
import { IExecuteProcessService, IExecutionContextFascade, IFlowNodeHandler, IFlowNodeHandlerFactory, IProcessModelFascade,
  IProcessTokenFascade, Model, NextFlowNodeInfo, Runtime} from '@process-engine/process_engine_contracts';
import { ProcessTokenFascade } from '.';

import * as uuid from 'uuid';
import { ExecutionContextFascade } from './execution_context_fascade';
import { ProcessModelFascade } from './process_model_fascade';

export class ExecuteProcessService implements IExecuteProcessService {

  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory = undefined;
  private _datastoreService: IDatastoreService = undefined;
  private _messageBusService: IMessageBusService;

  constructor(flowNodeHandlerFactory: IFlowNodeHandlerFactory,
              datastoreService: IDatastoreService,
              messageBusService: IMessageBusService) {
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this._datastoreService = datastoreService;
    this._messageBusService = messageBusService;
  }

  private get flowNodeHandlerFactory(): IFlowNodeHandlerFactory {
    return this._flowNodeHandlerFactory;
  }

  private get datastoreService(): IDatastoreService {
    return this._datastoreService;
  }

  private get messageBusService(): IMessageBusService {
    return this._messageBusService;
  }

  public async start(context: ExecutionContext, process: Model.Types.Process, initialToken?: any): Promise<any> {

    const processModelFascade: IProcessModelFascade = new ProcessModelFascade(process);

    const startEvent: Model.Events.StartEvent = processModelFascade.getStartEvent();

    const processInstance: Runtime.Types.ProcessInstance = this._createProcessInstance(process);

    const processToken: Runtime.Types.ProcessToken = this._createProcessToken(context);
    const processTokenFascade: IProcessTokenFascade = new ProcessTokenFascade(processToken);
    const executionContextFascade: IExecutionContextFascade = new ExecutionContextFascade(context);

    processTokenFascade.addResultForFlowNode(startEvent.id, initialToken);

    await this._executeFlowNode(startEvent, processTokenFascade, processModelFascade, executionContextFascade);

    const resultToken: any = await processTokenFascade.getOldTokenFormat();

    return resultToken.current;
    // await this._end(processInstance, resultToken, context);
  }

  private _createProcessInstance(processDefinition: Model.Types.Process): Runtime.Types.ProcessInstance {
    const processInstance: Runtime.Types.ProcessInstance = new Runtime.Types.ProcessInstance();
    processInstance.processInstanceId = uuid.v4();

    return processInstance;
  }

  private async _executeFlowNode(flowNode: Model.Base.FlowNode,
                                 processTokenFascade: IProcessTokenFascade,
                                 processModelFascade: IProcessModelFascade,
                                 executionContextFascade: IExecutionContextFascade): Promise<void> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFascade);

    const nextFlowNodeInfo: NextFlowNodeInfo = await flowNodeHandler.execute(flowNode,
                                                                             processTokenFascade,
                                                                             processModelFascade,
                                                                             executionContextFascade);

    if (nextFlowNodeInfo.flowNode !== undefined) {
      await this._executeFlowNode(nextFlowNodeInfo.flowNode, nextFlowNodeInfo.processTokenFascade, processModelFascade, executionContextFascade);
    }
  }

  private async _end(processInstance: Runtime.Types.ProcessInstance,
                     processToken: Runtime.Types.ProcessToken,
                     context: ExecutionContext): Promise<void> {
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
