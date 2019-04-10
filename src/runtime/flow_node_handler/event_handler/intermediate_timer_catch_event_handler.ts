import {Logger} from 'loggerhythm';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  ITimerFacade,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {EventHandler} from './index';

export class IntermediateTimerCatchEventHandler extends EventHandler<Model.Events.IntermediateCatchEvent> {

  private _timerFacade: ITimerFacade;
  private timerSubscription: Subscription;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    timerFacade: ITimerFacade, timerCatchEventModel: Model.Events.IntermediateCatchEvent,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, timerCatchEventModel);
    this._timerFacade = timerFacade;
    this.logger = Logger.createLogger(`processengine:timer_catch_event_handler:${timerCatchEventModel.id}`);
  }

  private get timerCatchEvent(): Model.Events.IntermediateCatchEvent {
    return super.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing TimerCatchEvent instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return await this._executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async _executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise: Promise<Array<Model.Base.FlowNode>> =
      new Promise<Array<Model.Base.FlowNode>>(async(resolve: Function, reject: Function): Promise<void> => {

      try {
        this.onInterruptedCallback = (interruptionToken: ProcessToken): void => {

          if (this.timerSubscription) {
            this._timerFacade.cancelTimerSubscription(this.timerSubscription);
          }

          processTokenFacade.addResultForFlowNode(this.timerCatchEvent.id, this.flowNodeInstanceId, interruptionToken);

          handlerPromise.cancel();

          return;
        };

        await this._suspendAndExecuteTimer(token, processTokenFacade);

        processTokenFacade.addResultForFlowNode(this.timerCatchEvent.id, this.flowNodeInstanceId, token.payload);

        await this.persistOnResume(token);
        await this.persistOnExit(token);

        const nextFlowNodeInfo: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.timerCatchEvent);

        return resolve(nextFlowNodeInfo);
      } catch (error) {
        return reject(error);
      }
    });

    return handlerPromise;
  }

  protected async _continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise: Promise<Array<Model.Base.FlowNode>> =
      new Promise<Array<Model.Base.FlowNode>>(async(resolve: Function, reject: Function): Promise<void> => {

      try {
        this.onInterruptedCallback = (interruptionToken: ProcessToken): void => {

          if (this.timerSubscription) {
            this._timerFacade.cancelTimerSubscription(this.timerSubscription);
          }

          processTokenFacade.addResultForFlowNode(this.timerCatchEvent.id, this.flowNodeInstanceId, interruptionToken);

          handlerPromise.cancel();

          return;
        };

        await this._executeTimer(processTokenFacade);

        processTokenFacade.addResultForFlowNode(this.timerCatchEvent.id, this.flowNodeInstanceId, onSuspendToken.payload);

        await this.persistOnResume(onSuspendToken);
        await this.persistOnExit(onSuspendToken);

        const nextFlowNodeInfo: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.timerCatchEvent);

        return resolve(nextFlowNodeInfo);
      } catch (error) {
        return reject(error);
      }
    });

    return handlerPromise;
  }

  private async _suspendAndExecuteTimer(token: ProcessToken, processTokenFacade: IProcessTokenFacade): Promise<void> {
    const waitForTimerPromise: Promise<void> = this._executeTimer(processTokenFacade);
    await this.persistOnSuspend(token);

    return await waitForTimerPromise;
  }

  private async _executeTimer(processTokenFacade: IProcessTokenFacade): Promise<void> {

    return new Promise<void>(async(resolve: Function, reject: Function): Promise<void> => {
      try {
        const timerElapsed: any = (): void => {
          // TODO: Can't handle cyclic timers yet, so we always need to clean this up for now.
          this._timerFacade.cancelTimerSubscription(this.timerSubscription);
          resolve();
        };

        this.timerSubscription = this
          ._timerFacade
          .initializeTimerFromDefinition(this.timerCatchEvent, this.timerCatchEvent.timerEventDefinition, processTokenFacade, timerElapsed);
      } catch (error) {
        return reject(error);
      }
    });
  }
}
