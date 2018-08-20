import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {InternalServerError} from '@essential-projects/errors_ts';

import {
  EndEventReachedMessage,
  EventReachedMessage,
  IExecuteProcessService,
  IExecutionContextFacade,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  IProcessTokenResult,
  Model,
  NextFlowNodeInfo,
  Runtime,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {ProcessModelFacade} from './process_model_facade';
import {ProcessTokenFacade} from './process_token_facade';

import * as uuid from 'uuid';

import {Logger} from 'loggerhythm';

const logger: Logger = Logger.createLogger('processengine:execute_process_service');

export class ExecuteProcessService implements IExecuteProcessService {

  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory = undefined;
  private _flowNodeInstanceService: IFlowNodeInstanceService = undefined;
  private _eventAggregator: IEventAggregator = undefined;

  private _processWasTerminated: boolean = false;
  private _processTerminationMessage: TerminateEndEventReachedMessage = undefined;

  constructor(flowNodeHandlerFactory: IFlowNodeHandlerFactory,
              flowNodeInstanceService: IFlowNodeInstanceService,
              eventAggregator: IEventAggregator) {

    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._eventAggregator = eventAggregator;
  }

  private get flowNodeHandlerFactory(): IFlowNodeHandlerFactory {
    return this._flowNodeHandlerFactory;
  }

  private get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  public async start(executionContextFacade: IExecutionContextFacade,
                     processModel: Model.Types.Process,
                     startEventId: string,
                     correlationId: string,
                     initialPayload?: any,
                     caller?: string): Promise<IProcessTokenResult> {

    const processModelFacade: IProcessModelFacade = new ProcessModelFacade(processModel);

    const startEvent: Model.Events.StartEvent = processModelFacade.getStartEventById(startEventId);

    const processInstanceId: string = uuid.v4();

    if (!correlationId) {
      correlationId = uuid.v4();
    }

    if (initialPayload === undefined || initialPayload === null) {
      initialPayload = {};
    }

    const identity: IIdentity = await executionContextFacade.getIdentity();
    const processTokenFacade: IProcessTokenFacade = new ProcessTokenFacade(processInstanceId, processModel.id, correlationId, identity);

    const processToken: Runtime.Types.ProcessToken = processTokenFacade.createProcessToken(initialPayload);
    processToken.caller = caller;
    processTokenFacade.addResultForFlowNode(startEvent.id, initialPayload);

    const processTerminationSubscription: ISubscription = this._createProcessTerminationSubscription(processInstanceId);

    await this._executeFlowNode(startEvent, processToken, processTokenFacade, processModelFacade, executionContextFacade);

    const resultToken: IProcessTokenResult = await this._getFinalResult(processTokenFacade);

    if (processTerminationSubscription) {
      processTerminationSubscription.dispose();
    }

    await this._end(processInstanceId, resultToken);

    return resultToken;
  }

  public async startAndAwaitSpecificEndEvent(executionContextFacade: IExecutionContextFacade,
                                             processModel: Model.Types.Process,
                                             startEventId: string,
                                             correlationId: string,
                                             endEventId: string,
                                             initialPayload?: any,
                                             caller?: string): Promise<EndEventReachedMessage> {

    return new Promise<EndEventReachedMessage>(async(resolve: Function, reject: Function): Promise<void> => {

      const subscription: ISubscription =
        this.eventAggregator.subscribeOnce(`/processengine/node/${endEventId}`, async(message: EndEventReachedMessage): Promise<void> => {

          if (this._processWasTerminated) {
            return reject(new InternalServerError(`Process was terminted through TerminateEndEvent "${this._processTerminationMessage.eventId}"`));
          }

          resolve(message);
        });

      try {
        await this.start(executionContextFacade, processModel, startEventId, correlationId, initialPayload, caller);
      } catch (error) {
        const errorMessage: string =
          `An error occured while trying to execute process model with id "${processModel.id}" in correlation "${correlationId}".`;
        logger.error(errorMessage, error);

        if (subscription) {
          subscription.dispose();
        }

        // If we received an error that was thrown by an ErrorEndEvent, pass on the error as it was received.
        // Otherwise, pass on an anonymous error.
        if (error.errorCode && error.name) {
          return reject(error);
        }

        reject(new InternalServerError(error.message));
      }
    });
  }

  public async startAndAwaitEndEvent(executionContextFacade: IExecutionContextFacade,
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

          if (this._processWasTerminated) {
            return reject(new InternalServerError(`Process was terminted through TerminateEndEvent "${this._processTerminationMessage.eventId}"`));
          }

          resolve(message);
        });

        subscriptions.push(subscription);
      }

      try {
        await this.start(executionContextFacade, processModel, startEventId, correlationId, initialPayload, caller);

      } catch (error) {
        const errorMessage: string =
          `An error occured while trying to execute process model with id "${processModel.id}" in correlation "${correlationId}".`;
        logger.error(errorMessage, error);

        for (const subscription of subscriptions) {
          subscription.dispose();
        }

        // If we received an error that was thrown by an ErrorEndEvent, pass on the error as it was received.
        // Otherwise, pass on an anonymous error.
        if (error.errorCode && error.name) {
          return reject(error);
        }
        reject(new InternalServerError(error.message));
      }

    });
  }

  private _createProcessTerminationSubscription(processInstanceId: string): ISubscription {

    const eventName: string = `/processengine/process/${processInstanceId}/terminated`;

    return this
      .eventAggregator
      .subscribeOnce(eventName, async(message: TerminateEndEventReachedMessage): Promise<void> => {
        this._processTerminationMessage = message;
        this._processWasTerminated = true;
    });
  }

  private async _executeFlowNode(flowNode: Model.Base.FlowNode,
                                 processToken: Runtime.Types.ProcessToken,
                                 processTokenFacade: IProcessTokenFacade,
                                 processModelFacade: IProcessModelFacade,
                                 executionContextFacade: IExecutionContextFacade): Promise<void> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo =
      await flowNodeHandler.execute(flowNode, processToken, processTokenFacade, processModelFacade, executionContextFacade);

    if (this._processWasTerminated) {
      await this.flowNodeInstanceService.persistOnTerminate(executionContextFacade, processToken, flowNode.id, processToken.processInstanceId);
    } else if (nextFlowNodeInfo.flowNode !== undefined) {
      await this._executeFlowNode(nextFlowNodeInfo.flowNode,
                                  nextFlowNodeInfo.token,
                                  nextFlowNodeInfo.processTokenFacade,
                                  processModelFacade,
                                  executionContextFacade);
    }
  }

  private async _getFinalResult(processTokenFacade: IProcessTokenFacade): Promise<IProcessTokenResult> {

    const allResults: Array<IProcessTokenResult> = await processTokenFacade.getAllResults();

    return allResults.pop();
  }

  private async _end(processInstanceId: string,
                     processTokenResult: IProcessTokenResult): Promise<void> {

    let processEndMessage: EventReachedMessage;

    if (this._processWasTerminated) {
      processEndMessage = new TerminateEndEventReachedMessage(processTokenResult.flowNodeId, processTokenResult.result);
    } else {
      processEndMessage = new EndEventReachedMessage(processTokenResult.flowNodeId, processTokenResult.result);
    }

    this.eventAggregator.publish(`/processengine/process/${processInstanceId}`, processEndMessage);
  }

}
