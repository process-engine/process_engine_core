import {Logger} from 'loggerhythm';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  eventAggregatorSettings,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEventReachedMessage,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class SendTaskHandler extends FlowNodeHandler<Model.Activities.SendTask> {
  private _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingService: ILoggingApi,
              metricsService: IMetricsApi,
              sendTaskModel: Model.Activities.SendTask) {
    super(flowNodeInstanceService, loggingService, metricsService, sendTaskModel);
    this._eventAggregator = eventAggregator;
    this.logger = new Logger(`processengine:send_task_handler:${sendTaskModel.id}`);
  }

  private get sendTask(): Model.Activities.SendTask {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Executing SendTask instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);
    await this.persistOnSuspend(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Resuming FlowNodeInstance ${flowNodeInstance.id}.`);

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.suspended:
        this.logger.verbose(`FlowNodeInstance was left suspended. Waiting for the SendTask to receive a response.`);
        const suspendToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onSuspend);

        return this._continueAfterSuspend(flowNodeInstance, suspendToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.running:

        const resumeToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onResume);

        const noResponseReceivedYet: boolean = resumeToken === undefined;
        if (noResponseReceivedYet) {
          this.logger.verbose(`FlowNodeInstance was interrupted at the beginning. Resuming from the start.`);
          const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onEnter);

          return this._continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade);
        }

        this.logger.verbose(`The SendTask already received a response and the handler was resumed. Finishing up the handler.`);

        return this._continueAfterResume(resumeToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.finished:
        this.logger.verbose(`FlowNodeInstance was already finished. Skipping ahead.`);
        const onExitToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onExit);

        return this._continueAfterExit(onExitToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.error:
        this.logger.error(`Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because it previously exited with an error!`,
                     flowNodeInstance.error);
        throw flowNodeInstance.error;

      case Runtime.Types.FlowNodeInstanceState.terminated:
        const terminatedError: string = `Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because it was terminated!`;
        this.logger.error(terminatedError);
        throw new InternalServerError(terminatedError);

      default:
        const invalidStateError: string = `Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because its state cannot be determined!`;
        this.logger.error(invalidStateError);
        throw new InternalServerError(invalidStateError);
    }
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
                                  processModelFacade: IProcessModelFacade,
                                 ): Promise<NextFlowNodeInfo> {

    return new Promise<NextFlowNodeInfo>(async(resolve: Function, reject: Function): Promise<void> => {

      const onResponseReceivedCallback: Function = async(): Promise<void> => {

        await this.persistOnResume(token);
        await this.persistOnExit(token);

        const nextFlowNodeInfo: NextFlowNodeInfo = await this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);

        return resolve(nextFlowNodeInfo);
      };

      this._waitForResponseFromReceiveTask(onResponseReceivedCallback);
      this._sendMessage(token);
    });
  }

  /**
   * Waits for an incoming message from a ReceiveTask, acknowledging the receit of the message.
   *
   * @param callback The function to call upon receiving the message.
   */
  private _waitForResponseFromReceiveTask(callback: Function): void {

    const messageName: string = this.sendTask.messageEventDefinition.name;

    const messageEventName: string = eventAggregatorSettings
      .routePaths
      .receiveTaskReached
      .replace(eventAggregatorSettings.routeParams.messageReference, messageName);

    const subscription: ISubscription = this._eventAggregator.subscribeOnce(messageEventName, () => {

      if (subscription) {
        subscription.dispose();
      }
      callback();
    });
  }

  /**
   * Publishes the message stored in this SendTask on the EventAggregator.
   *
   * @param token The current process token.
   */
  private _sendMessage(token: Runtime.Types.ProcessToken): void {

    const messageName: string = this.sendTask.messageEventDefinition.name;

    const messageEventName: string = eventAggregatorSettings
      .routePaths
      .sendTaskReached
      .replace(eventAggregatorSettings.routeParams.messageReference, messageName);

    const messageToSend: MessageEventReachedMessage = new MessageEventReachedMessage(
                                                                    messageName,
                                                                    token.correlationId,
                                                                    token.processModelId,
                                                                    token.processInstanceId,
                                                                    this.sendTask.id,
                                                                    token);

    this._eventAggregator.publish(messageEventName, messageToSend);
  }
}
