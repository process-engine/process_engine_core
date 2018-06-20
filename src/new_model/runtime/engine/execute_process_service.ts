import { ExecutionContext } from '@essential-projects/core_contracts';
import { IDatastoreService } from '@essential-projects/data_model_contracts';
import { IDataMessage, IMessageBusService } from '@essential-projects/messagebus_contracts';
import { IExecuteProcessService, IExecutionContextFacade, IFlowNodeHandler, IFlowNodeHandlerFactory, IProcessModelFacade,
  IProcessTokenFacade, Model, NextFlowNodeInfo, Runtime} from '@process-engine/process_engine_contracts';
import { ProcessTokenFacade } from '.';

import * as uuid from 'uuid';
import { IEventAggregator, ISubscription } from '../../../../node_modules/@essential-projects/event_aggregator_contracts';
import { ExecutionContextFacade } from './execution_context_facade';
import { ProcessModelFacade } from './process_model_facade';

export class ExecuteProcessService implements IExecuteProcessService {

  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory = undefined;
  private _datastoreService: IDatastoreService = undefined;
  private _messageBusService: IMessageBusService = undefined;
  private _eventAggregator: IEventAggregator = undefined;

  constructor(flowNodeHandlerFactory: IFlowNodeHandlerFactory,
              messageBusService: IMessageBusService,
              eventAggregator: IEventAggregator) {
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this._messageBusService = messageBusService;
    this._eventAggregator = eventAggregator;
  }

  private get flowNodeHandlerFactory(): IFlowNodeHandlerFactory {
    return this._flowNodeHandlerFactory;
  }

  private get messageBusService(): IMessageBusService {
    return this._messageBusService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  public async start(context: ExecutionContext,
                     processModel: Model.Types.Process,
                     correlationId: string,
                     initialPayload?: any,
                     caller?: string): Promise<any> {

    const processModelFacade: IProcessModelFacade = new ProcessModelFacade(processModel);

    const startEvents: Array<Model.Events.StartEvent> = processModelFacade.getStartEvents();
    const startEvent: Model.Events.StartEvent = startEvents[0];

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

    return new Promise(async(resolve: Function, reject: Function): Promise<void> => {

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

    const endEvents: Array<Model.Events.EndEvent> = processModelFacade.getEndEvents();
    const subscriptions: Array<ISubscription> = [];

    return new Promise(async(resolve: Function, reject: Function): Promise<void> => {
      for (const endEvent of endEvents) {

        const subscription: ISubscription
          = this.eventAggregator.subscribeOnce(`/processengine/node/${endEvent.id}`, async(message: any): Promise<void> => {

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
      await this._executeFlowNode(nextFlowNodeInfo.flowNode,
                                  nextFlowNodeInfo.token,
                                  nextFlowNodeInfo.processTokenFacade,
                                  processModelFacade,
                                  executionContextFacade);
    }
  }

  private async _end(processInstanceId: string,
                     processToken: any,
                     context: ExecutionContext): Promise<void> {
    const processEndMessageData: any = {
      event: 'end',
      token: processToken.current,
    };

    const processEndMessage: IDataMessage = this.messageBusService.createDataMessage(processEndMessageData, context);
    this.messageBusService.publish(`/processengine/process/${processInstanceId}`, processEndMessage);
  }

}
