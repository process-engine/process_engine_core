import {ExecutionContext, IIdentity} from '@essential-projects/core_contracts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IDataMessage, IMessageBusService} from '@essential-projects/messagebus_contracts';

import {
  EndEventReachedMessage,
  IExecuteProcessService,
  IExecutionContextFacade,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {ExecutionContextFacade} from './execution_context_facade';
import {ProcessModelFacade} from './process_model_facade';
import {ProcessTokenFacade} from './process_token_facade';

import * as uuid from 'uuid';

import {Logger} from 'loggerhythm';

const logger: Logger = Logger.createLogger('processengine:execute_process_service');

export class ExecuteProcessService implements IExecuteProcessService {

  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory = undefined;
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
                     startEventId: string,
                     correlationId: string,
                     initialPayload?: any,
                     caller?: string): Promise<any> {

    const processModelFacade: IProcessModelFacade = new ProcessModelFacade(processModel);

    const startEvent: Model.Events.StartEvent = processModelFacade.getStartEventById(startEventId);

    const processInstanceId: string = uuid.v4();

    const identity: IIdentity = await context.getIdentity(context);
    const processTokenFacade: IProcessTokenFacade = new ProcessTokenFacade(processInstanceId, processModel.id, correlationId, identity);
    const executionContextFacade: IExecutionContextFacade = new ExecutionContextFacade(context);

    const processToken: Runtime.Types.ProcessToken = processTokenFacade.createProcessToken(initialPayload);
    processToken.caller = caller;
    processTokenFacade.addResultForFlowNode(startEvent.id, initialPayload);

    await this._executeFlowNode(startEvent, processToken, processTokenFacade, processModelFacade, executionContextFacade);

    const resultToken: any = await processTokenFacade.getOldTokenFormat();

    await this._end(processInstanceId, resultToken, context);

    return resultToken.current;
  }

  public async startAndAwaitSpecificEndEvent(context: ExecutionContext,
                                             processModel: Model.Types.Process,
                                             startEventId: string,
                                             correlationId: string,
                                             endEventId: string,
                                             initialPayload?: any,
                                             caller?: string): Promise<EndEventReachedMessage> {

    return new Promise<EndEventReachedMessage>(async(resolve: Function, reject: Function): Promise<void> => {

      const subscription: ISubscription =
        this.eventAggregator.subscribeOnce(`/processengine/node/${endEventId}`, async(message: EndEventReachedMessage): Promise<void> => {
          resolve(message);
        });

      try {
        await this.start(context, processModel, startEventId, correlationId, initialPayload, caller);
      } catch (error) {
        // tslint:disable-next-line:max-line-length
        const errorMessage: string = `An error occured while trying to execute process model with id "${processModel.id}" in correlation "${correlationId}".`;
        logger.error(errorMessage, error);

        if (subscription) {
          subscription.dispose();
        }
        reject(error);
      }
    });
  }

  public async startAndAwaitEndEvent(context: ExecutionContext,
                                     processModel: Model.Types.Process,
                                     startEventId: string,
                                     correlationId: string,
                                     initialPayload?: any,
                                     caller?: string): Promise<EndEventReachedMessage> {

    const processModelFacade: IProcessModelFacade = new ProcessModelFacade(processModel);

    const endEvents: Array<Model.Events.EndEvent> = processModelFacade.getEndEvents();
    const subscriptions: Array<ISubscription> = [];

    return new Promise<EndEventReachedMessage>(async(resolve: Function, reject: Function): Promise<void> => {
      for (const endEvent of endEvents) {

        const subscription: ISubscription
          = this.eventAggregator.subscribeOnce(`/processengine/node/${endEvent.id}`, async(message: EndEventReachedMessage): Promise<void> => {

          for (const existingSubscription of subscriptions) {
            existingSubscription.dispose();
          }

          resolve(message);
        });

        subscriptions.push(subscription);
      }

      try {
        await this.start(context, processModel, startEventId, correlationId, initialPayload, caller);

      } catch (error) {
        // tslint:disable-next-line:max-line-length
        const errorMessage: string = `An error occured while trying to execute process model with id "${processModel.id}" in correlation "${correlationId}".`;
        logger.error(errorMessage, error);

        for (const subscription of subscriptions) {
          subscription.dispose();
        }
        reject(error);
      }

    });
  }

  private async _executeFlowNode(flowNode: Model.Base.FlowNode,
                                 processToken: Runtime.Types.ProcessToken,
                                 processTokenFacade: IProcessTokenFacade,
                                 processModelFacade: IProcessModelFacade,
                                 executionContextFacade: IExecutionContextFacade): Promise<void> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo = await flowNodeHandler.execute(flowNode,
                                                                             processToken,
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
