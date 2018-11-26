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
  }

  private get sendTask(): Model.Activities.SendTask {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);
    await this.persistOnSuspend(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<NextFlowNodeInfo> {

    function getFlowNodeInstanceTokenByType(tokenType: Runtime.Types.ProcessTokenType): Runtime.Types.ProcessToken {
      return flowNodeInstance.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
        return token.type === tokenType;
      });
    }

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.suspended:
        const suspendToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onSuspend);

        return this._continueAfterSuspend(suspendToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.running:

        const resumeToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onResume);

        const noResponseReceivedYet: boolean = resumeToken === undefined;
        if (noResponseReceivedYet) {
          const onEnterToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onEnter);

          return this._continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade);
        }

        return this._continueAfterResume(resumeToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.finished:
        const onExitToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onExit);

        return this._continueAfterExit(onExitToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.error:
        throw flowNodeInstance.error;
      case Runtime.Types.FlowNodeInstanceState.terminated:
        throw new InternalServerError(`Cannot resume SendTask instance ${flowNodeInstance.id}, because it was terminated!`);
      default:
        throw new InternalServerError(`Cannot resume SendTask instance ${flowNodeInstance.id}, because its state cannot be determined!`);
    }
  }

  /**
   * Resumes the given FlowNodeInstance from the point where it assumed the
   * "onSuspended" state.
   *
   * When the FlowNodeInstance was interrupted during this stage, we need to
   * run the handler again, except for the "onSuspend" state change.
   *
   * @async
   * @param   onSuspendToken     The token the FlowNodeInstance had when it was
   *                             suspended.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @returns                    The Info for the next FlowNode to run.
   */
  private async _continueAfterSuspend(onSuspendToken: Runtime.Types.ProcessToken,
                                      processTokenFacade: IProcessTokenFacade,
                                      processModelFacade: IProcessModelFacade,
                                     ): Promise<NextFlowNodeInfo> {

    return this._executeHandler(onSuspendToken, processTokenFacade, processModelFacade);
  }

  /**
   * Resumes the given FlowNodeInstance from the point where it assumed the
   * "onResumed" state.
   *
   * Basically, the ReceiveTask was already finished.
   * The final result is only missing in the database.
   *
   * @async
   * @param   resumeToken   The FlowNodeInstance to resume.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @returns                    The Info for the next FlowNode to run.
   */
  private async _continueAfterResume(resumeToken: Runtime.Types.ProcessToken,
                                     processTokenFacade: IProcessTokenFacade,
                                     processModelFacade: IProcessModelFacade,
                                    ): Promise<NextFlowNodeInfo> {

    processTokenFacade.addResultForFlowNode(this.sendTask.id, resumeToken.payload);
    await this.persistOnExit(resumeToken);

    return this.getNextFlowNodeInfo(resumeToken, processTokenFacade, processModelFacade);
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
