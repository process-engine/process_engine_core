import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  eventAggregatorSettings,
  FinishManualTaskMessage,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  ManualTaskFinishedMessage,
  ManualTaskReachedMessage,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class ManualTaskHandler extends FlowNodeHandler<Model.Activities.ManualTask> {

  private _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              manualTaskModel: Model.Activities.ManualTask) {
    super(flowNodeInstanceService, loggingApiService, metricsService, manualTaskModel);
    this._eventAggregator = eventAggregator;
  }

  private get manualTask(): Model.Activities.ManualTask {
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

        const noMessageReceivedYet: boolean = resumeToken === undefined;
        if (noMessageReceivedYet) {
          return this._continueAfterEnter(flowNodeInstance, processTokenFacade, processModelFacade);
        }

        return this._continueAfterResume(resumeToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.error:
      case Runtime.Types.FlowNodeInstanceState.terminated:
      case Runtime.Types.FlowNodeInstanceState.finished:

        const onExitToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onExit);
        processTokenFacade.addResultForFlowNode(this.manualTask.id, onExitToken);

        return this.getNextFlowNodeInfo(onExitToken, processTokenFacade, processModelFacade);
      default:
        throw new InternalServerError(`Cannot resume ManualTask instance ${flowNodeInstance.id}, because its state cannot be determined!`);
    }
  }

  /**
   * Resumes the given FlowNodeInstance from the point where it assumed the
   * "onEnter" state.
   *
   * Basically, the handler was not yet executed, except for the initial
   * state change.
   *
   * @async
   * @param   flowNodeInstance   The FlowNodeInstance to resume.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @returns                    The Info for the next FlowNode to run.
   */
  private async _continueAfterEnter(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                   ): Promise<NextFlowNodeInfo> {

    // When the FNI was interrupted directly after the onEnter state change, only one token will be present.
    const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.tokens[0];

    await this.persistOnSuspend(onEnterToken);

    return this._executeHandler(onEnterToken, processTokenFacade, processModelFacade);
  }

  /**
   * Resumes the given FlowNodeInstance from the point where it assumed the
   * "onSuspended" state.
   *
   * When the FlowNodeInstance was interrupted during this stage, we need to resubscribe
   * to the EventHandler and wait for the ManualTasks result.
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
   * Basically, the ManualTask was already finished.
   * The final result is only missing in the database.
   *
   * @async
   * @param   resumeToken        The ProcessToken stored after resuming the
   *                             FlowNodeInstance.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @returns                    The Info for the next FlowNode to run.
   */
  private async _continueAfterResume(resumeToken: Runtime.Types.ProcessToken,
                                     processTokenFacade: IProcessTokenFacade,
                                     processModelFacade: IProcessModelFacade,
                                    ): Promise<NextFlowNodeInfo> {

    processTokenFacade.addResultForFlowNode(this.manualTask.id, resumeToken.payload);

    await this.persistOnExit(resumeToken);
    this._sendManualTaskFinishedNotification(resumeToken);

    return this.getNextFlowNodeInfo(resumeToken, processTokenFacade, processModelFacade);
  }

  private async _executeHandler(token: Runtime.Types.ProcessToken,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                               ): Promise<NextFlowNodeInfo> {

    const manualTaskResult: any = await this._waitForManualTaskResult(token);
    token.payload = manualTaskResult;

    await this.persistOnResume(token);

    processTokenFacade.addResultForFlowNode(this.manualTask.id, manualTaskResult);
    await this.persistOnExit(token);

    this._sendManualTaskFinishedNotification(token);

    return this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);
  }

  /**
   * Suspends the current handler and waits for a FinishManualTaskMessage.
   * Upon receiving the messsage, the handler will be resumed.
   *
   * @async
   * @param token Contains all relevant info the EventAggregator will need for
   *              creating the EventSubscription.
   * @returns     The recevied ManualTask result.
   */
  private async _waitForManualTaskResult(token: Runtime.Types.ProcessToken): Promise<any> {

    return new Promise<any>(async(resolve: Function): Promise<void> => {

      const finishManualTaskEvent: string = this._getFinishManualTaskEventName(token.correlationId, token.processInstanceId);

      const subscription: ISubscription =
        this._eventAggregator.subscribeOnce(finishManualTaskEvent, async(message: FinishManualTaskMessage): Promise<void> => {

          // An empty object is used, because ManualTasks do not yield results.
          const manualTaskResult: any = {};

          if (subscription) {
            subscription.dispose();
          }

          resolve(manualTaskResult);
        });

      this._sendManualTaskReachedNotification(token);
    });
  }

  /**
   * Publishes a notification on the EventAggregator, informing about a new
   * suspended ManualTask.
   *
   * @param token Contains all infos required for the Notification message.
   */
  private _sendManualTaskReachedNotification(token: Runtime.Types.ProcessToken): void {

    const message: ManualTaskReachedMessage = new ManualTaskReachedMessage(token.correlationId,
                                                                       token.processModelId,
                                                                       token.processInstanceId,
                                                                       this.manualTask.id,
                                                                       this.flowNodeInstanceId,
                                                                       token.payload);

    this._eventAggregator.publish(eventAggregatorSettings.messagePaths.manualTaskReached, message);
  }

  /**
   * Publishes notifications on the EventAggregator, informing that a ManualTask
   * has finished execution.
   *
   * Two notifications will be send:
   * - A global notification that everybody can receive
   * - A notification specifically for this ManualTask.
   *
   * @param token Contains all infos required for the Notification message.
   */
  private _sendManualTaskFinishedNotification(token: Runtime.Types.ProcessToken): void {

    const message: ManualTaskFinishedMessage = new ManualTaskFinishedMessage(token.correlationId,
                                                                         token.processModelId,
                                                                         token.processInstanceId,
                                                                         this.manualTask.id,
                                                                         this.flowNodeInstanceId,
                                                                         token.payload);

    // FlowNode-specific notification
    const manualTaskFinishedEvent: string = this._getManualTaskFinishedEventName(token.correlationId, token.processInstanceId);
    this._eventAggregator.publish(manualTaskFinishedEvent, message);

    // Global notification
    this._eventAggregator.publish(eventAggregatorSettings.messagePaths.manualTaskFinished, message);
  }

  private _getFinishManualTaskEventName(correlationId: string, processInstanceId: string): string {

    const finishManualTaskEvent: string = eventAggregatorSettings.routePaths.finishManualTask
      .replace(eventAggregatorSettings.routeParams.correlationId, correlationId)
      .replace(eventAggregatorSettings.routeParams.processInstanceId, processInstanceId)
      .replace(eventAggregatorSettings.routeParams.flowNodeInstanceId, this.flowNodeInstanceId);

    return finishManualTaskEvent;
  }

  private _getManualTaskFinishedEventName(correlationId: string, processInstanceId: string): string {

    // FlowNode-specific notification
    const manualTaskFinishedEvent: string = eventAggregatorSettings.routePaths.manualTaskFinished
      .replace(eventAggregatorSettings.routeParams.correlationId, correlationId)
      .replace(eventAggregatorSettings.routeParams.processInstanceId, processInstanceId)
      .replace(eventAggregatorSettings.routeParams.flowNodeInstanceId, this.flowNodeInstanceId);

    return manualTaskFinishedEvent;
  }
}
