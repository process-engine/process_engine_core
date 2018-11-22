import * as uuid from 'uuid';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  eventAggregatorSettings,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  IResumeProcessService,
  Model,
  NextFlowNodeInfo,
  Runtime,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {ProcessTokenFacade} from '../process_token_facade';
import {FlowNodeHandler} from './index';

export class SubProcessHandler extends FlowNodeHandler<Model.Activities.SubProcess> {

  private _correlationService: ICorrelationService;
  private _eventAggregator: IEventAggregator;
  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory;
  private _resumeProcessService: IResumeProcessService;

  private _processTerminatedMessage: TerminateEndEventReachedMessage;

  constructor(correlationService: ICorrelationService,
              eventAggregator: IEventAggregator,
              flowNodeHandlerFactory: IFlowNodeHandlerFactory,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              resumeProcessService: IResumeProcessService,
              subProcessModel: Model.Activities.SubProcess) {
    super(flowNodeInstanceService, loggingApiService, metricsService, subProcessModel);

    this._correlationService = correlationService;
    this._eventAggregator = eventAggregator;
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this._resumeProcessService = resumeProcessService;
  }

  private get subProcess(): Model.Activities.SubProcess {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  public async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                identity: IIdentity,
                              ): Promise<NextFlowNodeInfo> {

    throw new Error('Not implemented yet.');
  }

  private async _executeHandler(token: Runtime.Types.ProcessToken,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                identity: IIdentity): Promise<NextFlowNodeInfo> {

    this._subscribeToProcessTerminatedEvent(token.processInstanceId);

    const initialSubProcessToken: any = await processTokenFacade.getOldTokenFormat();

    // The SubProcessModelFacade implements the same interface as the ProcessModelFacade.
    // It contains all FlowNode data for the SubProcess in question, but nothing more.
    const subProcessModelFacade: IProcessModelFacade = processModelFacade.getSubProcessModelFacade(this.subProcess);

    // This allows the SubProcess to access its parent processes token data, but prevents the parent process from
    // accessing the Subprocess' data until the SubProcess its finished.
    const subProcessTokenFacade: IProcessTokenFacade = await processTokenFacade.getProcessTokenFacadeForParallelBranch();

    await this.persistOnSuspend(token);
    const subProcessResult: any = await this._executeSubprocess(initialSubProcessToken, subProcessTokenFacade, subProcessModelFacade, identity);
    token.payload = subProcessResult;
    await this.persistOnResume(token);

    processTokenFacade.addResultForFlowNode(this.subProcess.id, subProcessResult);
    await this.persistOnExit(token);

    return this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);
  }

  private _subscribeToProcessTerminatedEvent(processInstanceId: string): void {

    const processTerminatedEvent: string = eventAggregatorSettings.routePaths.terminateEndEventReached
      .replace(eventAggregatorSettings.routeParams.processInstanceId, processInstanceId);

    const terminateEndEventSubscription: ISubscription =
      this._eventAggregator.subscribeOnce(processTerminatedEvent, (message: TerminateEndEventReachedMessage): void => {

        this._processTerminatedMessage = message;

        const terminationSubscriptionIsActive: boolean = terminateEndEventSubscription !== undefined;
        if (terminationSubscriptionIsActive) {
          terminateEndEventSubscription.dispose();
        }
      });
  }

  private async _executeSubprocess(currentProcessToken: Runtime.Types.ProcessToken,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   identity: IIdentity,
                                  ): Promise<any> {

    const subProcessModelFacade: IProcessModelFacade = processModelFacade.getSubProcessModelFacade(this.subProcess);

    const subProcessStartEvents: Array<Model.Events.StartEvent> = subProcessModelFacade.getStartEvents();
    const subProcessStartEvent: Model.Events.StartEvent = subProcessStartEvents[0];

    const subProcessInstanceId: string = uuid.v4();

    const initialTokenData: any = await processTokenFacade.getOldTokenFormat();
    const currentResults: any = await processTokenFacade.getAllResults();

    const subProcessTokenFacade: IProcessTokenFacade =
      new ProcessTokenFacade(subProcessInstanceId, this.subProcess.id, currentProcessToken.correlationId, identity);

    subProcessTokenFacade.importResults(currentResults);
    subProcessTokenFacade.addResultForFlowNode(subProcessStartEvent.id, initialTokenData.current);

    const subProcessToken: Runtime.Types.ProcessToken = subProcessTokenFacade.createProcessToken(initialTokenData.current);
    subProcessToken.caller = currentProcessToken.processInstanceId;

    await this._executeSubProcessFlowNode(subProcessStartEvent,
                                          subProcessToken,
                                          subProcessTokenFacade,
                                          subProcessModelFacade,
                                          identity,
                                          undefined);

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

    const processWasTerminated: boolean = this._processTerminatedMessage !== undefined;
    if (processWasTerminated) {
      await this.flowNodeInstanceService.persistOnTerminate(flowNode, currentFlowNodeInstanceId, token);
      const terminateEndEventId: string = this._processTerminatedMessage.flowNodeId;
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
