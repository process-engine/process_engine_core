import { ExecutionContext } from '@essential-projects/core_contracts';
import { IDatastoreService } from '@essential-projects/data_model_contracts';
import { IDataMessage, IMessageBusService } from '@essential-projects/messagebus_contracts';
import { IExecuteProcessService, IExecutionContextFacade, IFlowNodeHandler, IFlowNodeHandlerFactory, IProcessModelFacade,
  IProcessTokenFacade, Model, NextFlowNodeInfo, Runtime} from '@process-engine/process_engine_contracts';
import { ProcessTokenFacade } from '.';

import * as uuid from 'uuid';
import { ExecutionContextFacade } from './execution_context_facade';
import { ProcessModelFacade } from './process_model_facade';

export class ExecuteProcessService implements IExecuteProcessService {

  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory = undefined;
  private _datastoreService: IDatastoreService = undefined;
  private _messageBusService: IMessageBusService = undefined;
  private _processEngineStorageService: IProcessEngineStorageService = undefined;

  constructor(flowNodeHandlerFactory: IFlowNodeHandlerFactory,
              datastoreService: IDatastoreService,
              messageBusService: IMessageBusService,
              processEngineStorageService: IProcessEngineStorageService) {
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this._datastoreService = datastoreService;
    this._messageBusService = messageBusService;
    this._processEngineStorageService = processEngineStorageService;
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

  private get processEngineStorageService(): IProcessEngineStorageService {
    return this._processEngineStorageService;
  }

  public async start(context: ExecutionContext, process: Model.Types.Process, correlationId: string, initialToken?: any): Promise<any> {

    const processModelFacade: IProcessModelFacade = new ProcessModelFacade(process);

    const startEvent: Model.Events.StartEvent = processModelFacade.getStartEvent();

    const processInstance: Runtime.Types.ProcessInstance = this._createProcessInstance(process, correlationId);

    await this.processEngineStorageService.saveProcessInstance(processInstance);

    // ein großes wow für den folgenden methodenaufruf
    const identity: any = await context.getIdentity(context);
    const processTokenFacade: IProcessTokenFacade = new ProcessTokenFacade(processInstance.id, correlationId, identity);
    const executionContextFacade: IExecutionContextFacade = new ExecutionContextFacade(context);

    processTokenFacade.addResultForFlowNode(startEvent.id, initialToken);

    await this._executeFlowNode(startEvent, processTokenFacade, processModelFacade, executionContextFacade);

    const resultToken: any = await processTokenFacade.getOldTokenFormat();

    await this._end(processInstance, resultToken, context);

    return resultToken.current;
  }

  private _createProcessInstance(processDefinition: Model.Types.Process, correlationId: string): Runtime.Types.ProcessInstance {
    const processInstance: Runtime.Types.ProcessInstance = new Runtime.Types.ProcessInstance();
    processInstance.id = uuid.v4();
    processInstance.correlationId = correlationId;
    processInstance.processDefinition = processDefinition;

    return processInstance;
  }

  private async _executeFlowNode(flowNode: Model.Base.FlowNode,
                                 processTokenFacade: IProcessTokenFacade,
                                 processModelFacade: IProcessModelFacade,
                                 executionContextFacade: IExecutionContextFacade): Promise<void> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo = await flowNodeHandler.execute(flowNode,
                                                                             processTokenFacade,
                                                                             processModelFacade,
                                                                             executionContextFacade);

    if (nextFlowNodeInfo.flowNode !== undefined) {
      await this._executeFlowNode(nextFlowNodeInfo.flowNode, nextFlowNodeInfo.processTokenFacade, processModelFacade, executionContextFacade);
    }
  }

  private async _end(processInstance: Runtime.Types.ProcessInstance,
                     processToken: any,
                     context: ExecutionContext): Promise<void> {
    const processEndMessageData: any = {
      event: 'end',
      token: processToken.current,
    };

    const processEndMessage: IDataMessage = this.messageBusService.createDataMessage(processEndMessageData, context);
    this.messageBusService.publish(`/processengine/process/${processInstance.id}`, processEndMessage);
  }

}
