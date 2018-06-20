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

  public async start(context: ExecutionContext,
                     processModel: Model.Types.Process,
                     correlationId: string,
                     initialPayload?: any,
                     caller?: string): Promise<any> {

    const processModelFacade: IProcessModelFacade = new ProcessModelFacade(processModel);

    const startEvent: Model.Events.StartEvent = processModelFacade.getStartEvent();

    const processInstanceId: string = uuid.v4();

    const identity: any = await context.getIdentity(context);
    const processTokenFacade: IProcessTokenFacade = new ProcessTokenFacade(processInstanceId, processModel.id, correlationId, identity);
    const executionContextFacade: IExecutionContextFacade = new ExecutionContextFacade(context);

    const token: Runtime.Types.ProcessToken = processTokenFacade.createProcessToken(initialPayload);
    token.caller = caller;
    processTokenFacade.addResultForFlowNode(startEvent.id, initialPayload);

    await this._executeFlowNode(startEvent, token, processTokenFacade, processModelFacade, executionContextFacade);

    const resultToken: any = await processTokenFacade.getOldTokenFormat();

    await this._end(processInstanceId, resultToken, context);

    return resultToken.current;
  }

  public async startAndAwaitSpecificEndEvent(context: ExecutionContext,
                                             processModel: Model.Types.Process,
                                             correlationId: string,
                                             endEventId: string,
                                             initialPayload?: any): Promise<any> {

    return new Promise(async (resolve, reject) => {

      this.eventAggregator.subscribeOnce(`/processengine/node/${endEventId}`, async(message: any): Promise<void> => {
        resolve();
      });

      try {
        await this.start(context, processModel, correlationId, initialPayload, undefined);

      } catch (error) {
        reject(error);
      }
    });
  }

  public async startAndAwaitEndEvent(context: ExecutionContext,
                                     processModel: Model.Types.Process,
                                     correlationId: string,
                                     initialPayload?: any): Promise<any> {

    const processModelFacade: IProcessModelFacade = new ProcessModelFacade(processModel);

    const endEvents = processModelFacade.getEndEvents();
    const subscriptions = [];

    return new Promise(async (resolve, reject) => {
      for (const endEvent of endEvents) {

        const subscription = this.eventAggregator.subscribeOnce(`/processengine/node/${endEvent.id}`, async(message: any): Promise<void> => {

          for (const existingSubscription of subscriptions) {
            existingSubscription.dispose();
          }

          resolve();
        });

        subscriptions.push(subscription);
      }

      try {
        await this.start(context, processModel, correlationId, initialPayload, undefined);

      } catch (error) {
        reject(error);
      }

    });
  }

  private async _executeFlowNode(flowNode: Model.Base.FlowNode,
                                 token: Runtime.Types.ProcessToken,
                                 processTokenFacade: IProcessTokenFacade,
                                 processModelFacade: IProcessModelFacade,
                                 executionContextFacade: IExecutionContextFacade): Promise<void> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo = await flowNodeHandler.execute(flowNode,
                                                                             token,
                                                                             processTokenFacade,
                                                                             processModelFacade,
                                                                             executionContextFacade);

    if (nextFlowNodeInfo.flowNode !== undefined) {
      await this._executeFlowNode(nextFlowNodeInfo.flowNode, nextFlowNodeInfo.token, nextFlowNodeInfo.processTokenFacade, processModelFacade, executionContextFacade);
    }
  }

  private async _end(processInstanceId: string,
                     processToken: any,
                     context: ExecutionContext): Promise<void> {
    const processEndMessageData: any = {
      event: 'end',
      token: processToken.current,
    };
    console.log(`/processengine/process/${processInstanceId}`);
    const processEndMessage: IDataMessage = this.messageBusService.createDataMessage(processEndMessageData, context);
    this.messageBusService.publish(`/processengine/process/${processInstanceId}`, processEndMessage);
  }

}
