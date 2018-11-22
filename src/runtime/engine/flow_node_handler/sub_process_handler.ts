import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  eventAggregatorSettings,
  ICorrelationService,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';

import {FlowNodeHandler} from './index';

interface IProcessStateInfo {
  processTerminationSubscription?: ISubscription;
  processTerminatedMessage?: TerminateEndEventReachedMessage;
}

export class SubProcessHandler extends FlowNodeHandler<Model.Activities.SubProcess> {

  private _eventAggregator: IEventAggregator;
  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory;

  private processStateInfo: IProcessStateInfo = {};

  constructor(eventAggregator: IEventAggregator,
              flowNodeHandlerFactory: IFlowNodeHandlerFactory,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              subProcessModel: Model.Activities.SubProcess) {
    super(flowNodeInstanceService, loggingApiService, metricsService, subProcessModel);

    this._eventAggregator = eventAggregator;
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
  }

  private get subProcess(): Model.Activities.SubProcess {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);

    this._subscribeToProcessTerminatedEvent(token.processInstanceId);

    await this.persistOnSuspend(token);
    const subProcessResult: any = await this._executeSubprocess(token, processTokenFacade, processModelFacade, identity);
    token.payload = subProcessResult;
    await this.persistOnResume(token);

    const processTerminationSubscriptionIsActive: boolean = this.processStateInfo.processTerminationSubscription !== undefined;
    if (processTerminationSubscriptionIsActive) {
      this.processStateInfo.processTerminationSubscription.dispose();
    }

    processTokenFacade.addResultForFlowNode(this.subProcess.id, subProcessResult);
    await this.persistOnExit(token);

    return this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);
  }

  private _subscribeToProcessTerminatedEvent(processInstanceId: string): void {

    const processTerminatedEvent: string = eventAggregatorSettings.routePaths.terminateEndEventReached
      .replace(eventAggregatorSettings.routeParams.processInstanceId, processInstanceId);

    this.processStateInfo.processTerminationSubscription = this._eventAggregator
      .subscribeOnce(processTerminatedEvent, async(message: TerminateEndEventReachedMessage): Promise<void> => {
        this.processStateInfo.processTerminatedMessage = message;
      });
  }

  private async _executeSubprocess(currentProcessToken: Runtime.Types.ProcessToken,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<any> {

    const initialTokenData: any = await processTokenFacade.getOldTokenFormat();

    // This allows the SubProcess to access its parent processes token data, but prevents the parent process from
    // accessing the Subprocess' data until the SubProcess its finished.
    const subProcessTokenFacade: IProcessTokenFacade = await processTokenFacade.getProcessTokenFacadeForParallelBranch();

    // The SubProcessModelFacade implements the same interface as the ProcessModelFacade.
    // It contains all FlowNode data for the SubProcess in question, but nothing more.
    const subProcessModelFacade: IProcessModelFacade = processModelFacade.getSubProcessModelFacade(this.subProcess);

    const startEvents: Array<Model.Events.StartEvent> = subProcessModelFacade.getStartEvents();
    const startEvent: Model.Events.StartEvent = startEvents[0];

    subProcessTokenFacade.addResultForFlowNode(startEvent.id, initialTokenData.current);

    await this._executeSubProcessFlowNode(startEvent, currentProcessToken, subProcessTokenFacade, subProcessModelFacade, identity, undefined);

    // After all FlowNodes in the SubProcess have been executed, set the last "current" token value as a result of the whole SubProcess
    // and on the original ProcessTokenFacade, so that is is accessible by the original Process
    const subProcessTokenData: any = await subProcessTokenFacade.getOldTokenFormat();
    const subProcessResult: any = subProcessTokenData.current || {};

    return subProcessResult;
  }

  private async _executeSubProcessFlowNode(flowNode: Model.Base.FlowNode,
                                           token: Runtime.Types.ProcessToken,
                                           processTokenFacade: IProcessTokenFacade,
                                           processModelFacade: IProcessModelFacade,
                                           identity: IIdentity,
                                           previousFlowNodeInstanceId: string,
                                          ): Promise<void> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this._flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const currentFlowNodeInstanceId: string = flowNodeHandler.getInstanceId();

    const nextFlowNodeInfo: NextFlowNodeInfo =
      await flowNodeHandler.execute(token, processTokenFacade, processModelFacade, identity, previousFlowNodeInstanceId);

    const processWasTerminated: boolean = this.processStateInfo.processTerminatedMessage !== undefined;

    if (processWasTerminated) {
      await this.flowNodeInstanceService.persistOnTerminate(flowNode, this.flowNodeInstanceId, token);
      const terminateEndEventId: string = this.processStateInfo.processTerminatedMessage.flowNodeId;
      throw new InternalServerError(`Process was terminated through TerminateEndEvent "${terminateEndEventId}".`);
    }

    const subProcessHasAnotherFlowNodeToExecute: boolean = nextFlowNodeInfo.flowNode !== undefined;
    if (subProcessHasAnotherFlowNodeToExecute) {
      await this._executeSubProcessFlowNode(nextFlowNodeInfo.flowNode,
                                  nextFlowNodeInfo.token,
                                  nextFlowNodeInfo.processTokenFacade,
                                  processModelFacade,
                                  identity,
                                  currentFlowNodeInstanceId);
    }
  }

}
