import {IContainer} from 'addict-ioc';

import {InternalServerError} from '@essential-projects/errors_ts';
import {EventReceivedCallback, Subscription} from '@essential-projects/event_aggregator_contracts';
import {
  eventAggregatorSettings,
  IBoundaryEventHandlerFactory,
  IInterruptible,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  onInterruptionCallback,
  Runtime,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './flow_node_handler';

export abstract class FlowNodeHandlerInterruptible<TFlowNode extends Model.Base.FlowNode>
  extends FlowNodeHandler<TFlowNode>
  implements IInterruptible {

  private _boundaryEventHandlerFactory: IBoundaryEventHandlerFactory;

  private _terminationSubscription: Subscription;
  private _onInterruptedCallback: onInterruptionCallback;

  constructor(container: IContainer, flowNode: TFlowNode) {
    super(container, flowNode);
    // tslint:disable-next-line:no-empty
    this._onInterruptedCallback = (): void => {};
  }

  /**
   * Gets the callback that gets called when an interrupt-command was received.
   * This can be used by the derived handlers to perform handler-specific actions
   * necessary for stopping its work cleanly.
   *
   * Interruptions are currently done, when a TerminateEndEvent was reached, or
   * an interrupting BoundaryEvent was triggered.
   */
  protected get onInterruptedCallback(): onInterruptionCallback {
    return this._onInterruptedCallback;
  }

  /**
   * Sets the callback that gets called when an interrupt-command was received.
   */
  protected set onInterruptedCallback(value: onInterruptionCallback) {
    this._onInterruptedCallback = value;
  }

  public async initialize(): Promise<void> {
    await super.initialize();
    this._boundaryEventHandlerFactory = await this._container.resolveAsync<IBoundaryEventHandlerFactory>('BoundaryEventHandlerFactory');
  }

  protected async beforeExecute(
    token?: Runtime.Types.ProcessToken,
    processTokenFacade?: IProcessTokenFacade,
    processModelFacade?: IProcessModelFacade,
  ): Promise<void> {
    this._terminationSubscription = this._subscribeToProcessTermination(token);
    await this._attachBoundaryEvents();
  }

  protected async afterExecute(
    token?: Runtime.Types.ProcessToken,
    processTokenFacade?: IProcessTokenFacade,
    processModelFacade?: IProcessModelFacade,
  ): Promise<void> {
    this.eventAggregator.unsubscribe(this._terminationSubscription);
    await this._detachBoundaryEvents();
  }

  public async interrupt(token: Runtime.Types.ProcessToken, terminate?: boolean): Promise<void> {
    await this.onInterruptedCallback(token);

    if (terminate) {
      await this.persistOnTerminate(token);
      throw new InternalServerError(`Process was terminated!`);
    }

    return this.persistOnExit(token);
  }

  private _subscribeToProcessTermination(token: Runtime.Types.ProcessToken): Subscription {

    const terminateEvent: string = eventAggregatorSettings.messagePaths.terminateEndEventReached
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const onTerminatedCallback: EventReceivedCallback = async(message: TerminateEndEventReachedMessage): Promise<void> => {

      this.logger.error(`Process was terminated through TerminateEndEvent '${message.flowNodeId}'!`);

      token.payload = message.currentToken;
      await this.interrupt(token, true);
    };

    return this.eventAggregator.subscribeOnce(terminateEvent, onTerminatedCallback);
  }

  private async _attachBoundaryEvents(): Promise<void> {
    return Promise.resolve(); // TODO
  }

  private async _detachBoundaryEvents(): Promise<void> {
    return Promise.resolve(); // TODO
  }
}
