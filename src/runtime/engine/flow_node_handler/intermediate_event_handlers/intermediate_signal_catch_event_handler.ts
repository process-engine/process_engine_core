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

    function getFlowNodeInstanceTokenByType(tokenType: Runtime.Types.ProcessTokenType): Runtime.Types.ProcessToken {
      return flowNodeInstance.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
        return token.type === tokenType;
      });
    }

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.suspended:
        const suspendToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onSuspend);

        return this._continueAfterSuspend(flowNodeInstance, suspendToken, processTokenFacade, processModelFacade);
      case Runtime.Types.FlowNodeInstanceState.running:

        const resumeToken: Runtime.Types.ProcessToken = getFlowNodeInstanceTokenByType(Runtime.Types.ProcessTokenType.onResume);

        const signalNotYetReceived: boolean = resumeToken === undefined;
        if (signalNotYetReceived) {
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
        throw new InternalServerError(`Cannot resume SignalCatchEvent instance ${flowNodeInstance.id}, because it was terminated!`);
      default:
        throw new InternalServerError(`Cannot resume SignalCatchEvent instance ${flowNodeInstance.id}, because its state cannot be determined!`);
    }
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
