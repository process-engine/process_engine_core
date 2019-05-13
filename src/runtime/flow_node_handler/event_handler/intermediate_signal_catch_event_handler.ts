import {Logger} from 'loggerhythm';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  SignalEventReachedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {EventHandler} from './index';

export class IntermediateSignalCatchEventHandler extends EventHandler<Model.Events.IntermediateCatchEvent> {

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
    return this.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing SignalCatchEvent instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this.executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise = new Promise<any>(async (resolve: Function, reject: Function): Promise<void> => {

      this.onInterruptedCallback = (interruptionToken: ProcessToken): void => {

        if (this.subscription) {
          this.eventAggregator.unsubscribe(this.subscription);
        }

        processTokenFacade.addResultForFlowNode(this.signalCatchEvent.id, this.flowNodeInstanceId, interruptionToken);

        handlerPromise.cancel();

        return undefined;
      };

      const receivedMessage = await this.suspendAndWaitForSignal(token);

      token.payload = receivedMessage.currentToken;
      await this.persistOnResume(token);

      processTokenFacade.addResultForFlowNode(this.signalCatchEvent.id, this.flowNodeInstanceId, receivedMessage.currentToken);
      await this.persistOnExit(token);

      const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.signalCatchEvent);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  protected async continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise = new Promise<any>(async (resolve: Function, reject: Function): Promise<void> => {

      this.onInterruptedCallback = (interruptionToken: ProcessToken): void => {

        if (this.subscription) {
          this.eventAggregator.unsubscribe(this.subscription);
        }

        processTokenFacade.addResultForFlowNode(this.signalCatchEvent.id, this.flowNodeInstanceId, interruptionToken);

        handlerPromise.cancel();

        return undefined;
      };

      const receivedMessage = await this.waitForSignal();

      onSuspendToken.payload = receivedMessage.currentToken;
      await this.persistOnResume(onSuspendToken);

      processTokenFacade.addResultForFlowNode(this.signalCatchEvent.id, this.flowNodeInstanceId, receivedMessage.currentToken);
      await this.persistOnExit(onSuspendToken);

      const nextFlowNodeInfo = processModelFacade.getNextFlowNodesFor(this.signalCatchEvent);

      return resolve(nextFlowNodeInfo);
    });

    return handlerPromise;
  }

  private async suspendAndWaitForSignal(token: ProcessToken): Promise<SignalEventReachedMessage> {
    const waitForSignalPromise = this.waitForSignal();
    await this.persistOnSuspend(token);

    return waitForSignalPromise;
  }

  private async waitForSignal(): Promise<SignalEventReachedMessage> {

    return new Promise<SignalEventReachedMessage>((resolve: Function): void => {

      const signalEventName = eventAggregatorSettings.messagePaths.signalEventReached
        .replace(eventAggregatorSettings.messageParams.signalReference, this.signalCatchEvent.signalEventDefinition.name);

      this.subscription =
        this.eventAggregator.subscribeOnce(signalEventName, (signal: SignalEventReachedMessage): void => {
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
