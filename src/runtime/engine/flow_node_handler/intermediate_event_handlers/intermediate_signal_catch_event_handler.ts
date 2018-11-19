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
  Model,
  NextFlowNodeInfo,
  Runtime,
  SignalEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from '../index';

export class IntermediateSignalCatchEventHandler extends FlowNodeHandler<Model.Events.IntermediateCatchEvent> {

  private _eventAggregator: IEventAggregator;

  constructor(eventAggregator: IEventAggregator,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingService: ILoggingApi,
              metricsService: IMetricsApi,
              signalCatchEventModel: Model.Events.IntermediateCatchEvent) {
    super(flowNodeInstanceService, loggingService, metricsService, signalCatchEventModel);
    this._eventAggregator = eventAggregator;
  }

  private get signalCatchEvent(): Model.Events.IntermediateCatchEvent {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);
    await this.persistOnSuspend(token);

    return await this._executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                 ): Promise<NextFlowNodeInfo> {

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.suspended:
        return this._continueAfterSuspend(flowNodeInstance, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.running:

        const resumeToken: Runtime.Types.ProcessToken =
          flowNodeInstance.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
            return token.type === Runtime.Types.ProcessTokenType.onResume;
          });

        const signalNotYetReceived: boolean = resumeToken === undefined;
        if (signalNotYetReceived) {
          return this._continueAfterEnter(flowNodeInstance, processTokenFacade, processModelFacade);
        }

        return this._continueAfterResume(resumeToken, processTokenFacade, processModelFacade);
      default:
        throw new InternalServerError(`Cannot resume SignalCatchEvent instance ${flowNodeInstance.id}, because it was already finished!`);
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
   * When resuming at this stage, we need to subscribe to the EventAggregator
   * again and wait for the signal.
   *
   * @async
   * @param   flowNodeInstance   The FlowNodeInstance to resume.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @returns                    The Info for the next FlowNode to run.
   */
  private async _continueAfterSuspend(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                      processTokenFacade: IProcessTokenFacade,
                                      processModelFacade: IProcessModelFacade,
                                     ): Promise<NextFlowNodeInfo> {

    const suspendToken: Runtime.Types.ProcessToken =
      flowNodeInstance.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
        return token.type === Runtime.Types.ProcessTokenType.onSuspend;
      });

    return this._executeHandler(suspendToken, processTokenFacade, processModelFacade);
  }

  /**
   * Resumes the given FlowNodeInstance from the point where it assumed the
   * "onResumed" state.
   *
   * Basically, the signal was alrady received, but the final state change
   * did not happen.
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

    processTokenFacade.addResultForFlowNode(this.signalCatchEvent.id, resumeToken.payload);

    const nextNodeAfterUserTask: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.signalCatchEvent);

    await this.persistOnExit(resumeToken);

    return new NextFlowNodeInfo(nextNodeAfterUserTask, resumeToken, processTokenFacade);
  }

  private async _executeHandler(token: Runtime.Types.ProcessToken,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade): Promise<NextFlowNodeInfo> {

    const receivedSignal: SignalEventReachedMessage = await this._waitForSignal();

    token.payload = receivedSignal.currentToken;
    await this.persistOnResume(token);

    processTokenFacade.addResultForFlowNode(this.signalCatchEvent.id, receivedSignal.currentToken);
    await this.persistOnExit(token);

    const nextFlowNodeInfo: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.signalCatchEvent);

    return new NextFlowNodeInfo(nextFlowNodeInfo, token, processTokenFacade);
  }

  private async _waitForSignal(): Promise<SignalEventReachedMessage> {

    return new Promise<SignalEventReachedMessage>((resolve: Function): void => {

      const signalEventName: string = eventAggregatorSettings.routePaths.signalEventReached
        .replace(eventAggregatorSettings.routeParams.signalReference, this.signalCatchEvent.signalEventDefinition.name);

      const subscription: ISubscription = this._eventAggregator.subscribeOnce(signalEventName, async(signal: SignalEventReachedMessage) => {

        if (subscription) {
          subscription.dispose();
        }

        return resolve(signal);
      });
    });
  }
}
