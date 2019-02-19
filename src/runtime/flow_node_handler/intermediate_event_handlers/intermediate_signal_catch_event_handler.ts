import {Logger} from 'loggerhythm';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  eventAggregatorSettings,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  SignalEventReachedMessage,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {FlowNodeHandlerInterruptible} from '../index';

export class IntermediateSignalCatchEventHandler extends FlowNodeHandlerInterruptible<Model.Events.IntermediateCatchEvent> {

  private subscription: Subscription;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    signalCatchEventModel: Model.Events.IntermediateCatchEvent,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, signalCatchEventModel);
    this.logger = Logger.createLogger(`processengine:signal_catch_event_handler:${signalCatchEventModel.id}`);
  }

  private get signalCatchEvent(): Model.Events.IntermediateCatchEvent {
    return super.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing SignalCatchEvent instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);
    await this.persistOnSuspend(token);

    return await this._executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async _continueAfterEnter(
    onEnterToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    await this.persistOnSuspend(onEnterToken);

    return this._executeHandler(onEnterToken, processTokenFacade, processModelFacade);
  }

  protected async _continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    return this._executeHandler(onSuspendToken, processTokenFacade, processModelFacade);
  }

  protected async _executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise: Promise<any> = new Promise<any>(async(resolve: Function, reject: Function): Promise<void> => {

      const signalSubscriptionPromise: Promise<SignalEventReachedMessage> = this._waitForSignal();

      this.onInterruptedCallback = (interruptionToken: ProcessToken): void => {

        processTokenFacade.addResultForFlowNode(this.signalCatchEvent.id, this.flowNodeInstanceId, interruptionToken);

        if (this.subscription) {
          this.eventAggregator.unsubscribe(this.subscription);
        }

        signalSubscriptionPromise.cancel();
        handlerPromise.cancel();

        return;
      };

      const receivedMessage: SignalEventReachedMessage = await signalSubscriptionPromise;

      token.payload = receivedMessage.currentToken;
      await this.persistOnResume(token);

      processTokenFacade.addResultForFlowNode(this.signalCatchEvent.id, this.flowNodeInstanceId, receivedMessage.currentToken);
      await this.persistOnExit(token);

      const nextFlowNodeInfo: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.signalCatchEvent);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  private _waitForSignal(): Promise<SignalEventReachedMessage> {

    return new Promise<SignalEventReachedMessage>((resolve: Function): void => {

      const signalEventName: string = eventAggregatorSettings.messagePaths.signalEventReached
        .replace(eventAggregatorSettings.messageParams.signalReference, this.signalCatchEvent.signalEventDefinition.name);

      this.subscription =
        this.eventAggregator.subscribeOnce(signalEventName, async(signal: SignalEventReachedMessage) => {
          this.logger.verbose(
            `SignalCatchEvent instance ${this.flowNodeInstanceId} received signal ${signalEventName}:`,
            signal,
            'Resuming execution.',
          );

          return resolve(signal);
        });
      this.logger.verbose(`SignalCatchEvent instance ${this.flowNodeInstanceId} waiting for signal ${signalEventName}.`);
    });
  }
}
