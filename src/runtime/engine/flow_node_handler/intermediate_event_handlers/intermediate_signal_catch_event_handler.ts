import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  eventAggregatorSettings,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
  SignalEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandlerInterruptible} from '../index';

export class IntermediateSignalCatchEventHandler extends FlowNodeHandlerInterruptible<Model.Events.IntermediateCatchEvent> {

  private _eventAggregator: IEventAggregator;
  private subscription: Subscription;

  constructor(container: IContainer, eventAggregator: IEventAggregator, signalCatchEventModel: Model.Events.IntermediateCatchEvent) {
    super(container, signalCatchEventModel);
    this._eventAggregator = eventAggregator;
    this.logger = Logger.createLogger(`processengine:signal_catch_event_handler:${signalCatchEventModel.id}`);
  }

  private get signalCatchEvent(): Model.Events.IntermediateCatchEvent {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Executing SignalCatchEvent instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);
    await this.persistOnSuspend(token);

    return await this._executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async _continueAfterEnter(onEnterToken: Runtime.Types.ProcessToken,
                                      processTokenFacade: IProcessTokenFacade,
                                      processModelFacade: IProcessModelFacade,
                                     ): Promise<NextFlowNodeInfo> {

    await this.persistOnSuspend(onEnterToken);

    return this._executeHandler(onEnterToken, processTokenFacade, processModelFacade);
  }

  protected async _continueAfterSuspend(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                        onSuspendToken: Runtime.Types.ProcessToken,
                                        processTokenFacade: IProcessTokenFacade,
                                        processModelFacade: IProcessModelFacade,
                                      ): Promise<NextFlowNodeInfo> {

    return this._executeHandler(onSuspendToken, processTokenFacade, processModelFacade);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade): Promise<NextFlowNodeInfo> {

    const handlerPromise: Promise<any> = new Promise<any>(async(resolve: Function, reject: Function): Promise<void> => {

      const signalSubscriptionPromise: Promise<SignalEventReachedMessage> = this._waitForSignal();

      this.onInterruptedCallback = (interruptionToken: Runtime.Types.ProcessToken): void => {

        processTokenFacade.addResultForFlowNode(this.signalCatchEvent.id, interruptionToken);

        if (this.subscription) {
          this._eventAggregator.unsubscribe(this.subscription);
        }

        signalSubscriptionPromise.cancel();
        handlerPromise.cancel();

        return;
      };

      const receivedMessage: SignalEventReachedMessage = await signalSubscriptionPromise;

      token.payload = receivedMessage.currentToken;
      await this.persistOnResume(token);

      processTokenFacade.addResultForFlowNode(this.signalCatchEvent.id, receivedMessage.currentToken);
      await this.persistOnExit(token);

      const nextFlowNodeInfo: NextFlowNodeInfo = this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  private _waitForSignal(): Promise<SignalEventReachedMessage> {

    return new Promise<SignalEventReachedMessage>((resolve: Function): void => {

      const signalEventName: string = eventAggregatorSettings.messagePaths.signalEventReached
        .replace(eventAggregatorSettings.messageParams.signalReference, this.signalCatchEvent.signalEventDefinition.name);

      this.subscription =
        this._eventAggregator.subscribeOnce(signalEventName, async(signal: SignalEventReachedMessage) => {
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
