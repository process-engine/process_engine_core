import {Logger} from 'loggerhythm';
import * as uuid from 'uuid';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
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
  Model,
  NextFlowNodeInfo,
  Runtime,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {ProcessTokenFacade} from '../process_token_facade';
import {FlowNodeHandlerInterruptible} from './index';

export class SubProcessHandler extends FlowNodeHandlerInterruptible<Model.Activities.SubProcess> {

  private _eventAggregator: IEventAggregator;
  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory;
  private _processTerminatedMessage: TerminateEndEventReachedMessage;

  private terminateEndEventSubscription: Subscription;

  constructor(eventAggregator: IEventAggregator,
              flowNodeHandlerFactory: IFlowNodeHandlerFactory,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              subProcessModel: Model.Activities.SubProcess) {
    super(flowNodeInstanceService, loggingApiService, metricsService, subProcessModel);

    this._eventAggregator = eventAggregator;
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this.logger = Logger.createLogger(`processengine:sub_process_handler:${subProcessModel.id}`);
  }

  private get subProcess(): Model.Activities.SubProcess {
    return super.flowNode;
  }

  // TODO: We can't interrupt a Subprocess yet, so this will remain inactive.
  public interrupt(token: Runtime.Types.ProcessToken, terminate?: boolean): Promise<void> {
    return Promise.resolve();
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Executing SubProcess instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _continueAfterSuspend(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                        onSuspendToken: Runtime.Types.ProcessToken,
                                        processTokenFacade: IProcessTokenFacade,
                                        processModelFacade: IProcessModelFacade,
                                        identity: IIdentity,
                                       ): Promise<NextFlowNodeInfo> {

    this._subscribeToProcessTerminatedEvent(onSuspendToken.processInstanceId);

    // TODO: This can probably be removed, when we have refactored the way we handle ParallelGateways in general.
    // For now, we need that data here for use in the parallel branches.
    // ----
    const flowNodeInstancesForProcessModel: Array<Runtime.Types.FlowNodeInstance> =
      await this.flowNodeInstanceService.queryByProcessModel(this.subProcess.id);

    const flowNodeInstancesForSubProcess: Array<Runtime.Types.FlowNodeInstance> =
      flowNodeInstancesForProcessModel.filter((entry: Runtime.Types.FlowNodeInstance): boolean => {
        // TODO: Can be simplified, as soon as the DataModels for FlowNodeInstance and ProcessToken have been refactored.
        return entry.tokens[0].caller === onSuspendToken.processInstanceId;
      });
    // ----

    const subProcessWasNotStarted: boolean = flowNodeInstancesForSubProcess.length === 0;
    const subProcessResult: any = subProcessWasNotStarted
      ? await this._executeSubprocess(onSuspendToken, processTokenFacade, processModelFacade, identity)
      : await this._resumeSubProcess(flowNodeInstancesForSubProcess, onSuspendToken, processTokenFacade, processModelFacade, identity);

    onSuspendToken.payload = subProcessResult;
    await this.persistOnResume(onSuspendToken);

    processTokenFacade.addResultForFlowNode(this.subProcess.id, subProcessResult);
    await this.persistOnExit(onSuspendToken);

    this._eventAggregator.unsubscribe(this.terminateEndEventSubscription);

    return this.getNextFlowNodeInfo(onSuspendToken, processTokenFacade, processModelFacade);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade,
                                  identity: IIdentity): Promise<NextFlowNodeInfo> {

    this._subscribeToProcessTerminatedEvent(token.processInstanceId);

    await this.persistOnSuspend(token);
    const subProcessResult: any = await this._executeSubprocess(token, processTokenFacade, processModelFacade, identity);
    token.payload = subProcessResult;
    await this.persistOnResume(token);

    processTokenFacade.addResultForFlowNode(this.subProcess.id, subProcessResult);
    await this.persistOnExit(token);

    this._eventAggregator.unsubscribe(this.terminateEndEventSubscription);

    return this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);
  }

  private _subscribeToProcessTerminatedEvent(processInstanceId: string): void {

    const processTerminatedEvent: string = eventAggregatorSettings.routePaths.terminateEndEventReached
      .replace(eventAggregatorSettings.routeParams.processInstanceId, processInstanceId);

    this.terminateEndEventSubscription =
      this._eventAggregator.subscribeOnce(processTerminatedEvent, (message: TerminateEndEventReachedMessage): void => {
        this._processTerminatedMessage = message;
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

    const currentResults: any = processTokenFacade.getAllResults();

    const subProcessTokenFacade: IProcessTokenFacade =
      new ProcessTokenFacade(subProcessInstanceId, this.subProcess.id, currentProcessToken.correlationId, identity);

    subProcessTokenFacade.importResults(currentResults);
    subProcessTokenFacade.addResultForFlowNode(subProcessStartEvent.id, currentProcessToken.payload);

    const subProcessToken: Runtime.Types.ProcessToken = subProcessTokenFacade.createProcessToken(currentProcessToken.payload);
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
      await this.persistOnTerminate(token);
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

  private async _resumeSubProcess(flowNodeInstancesForSubprocess: Array<Runtime.Types.FlowNodeInstance>,
                                  currentProcessToken: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade,
                                  identity: IIdentity,
                                 ): Promise<any> {

    const subProcessModelFacade: IProcessModelFacade = processModelFacade.getSubProcessModelFacade(this.subProcess);

    const subProcessStartEvents: Array<Model.Events.StartEvent> = subProcessModelFacade.getStartEvents();
    const subProcessStartEvent: Model.Events.StartEvent = subProcessStartEvents[0];

    const currentResults: any = processTokenFacade.getAllResults();

    const subProcessInstanceId: string = flowNodeInstancesForSubprocess[0].processInstanceId;

    const subProcessTokenFacade: IProcessTokenFacade =
      new ProcessTokenFacade(subProcessInstanceId, this.subProcess.id, currentProcessToken.correlationId, identity);

    subProcessTokenFacade.importResults(currentResults);
    subProcessTokenFacade.addResultForFlowNode(subProcessStartEvent.id, currentProcessToken.payload);

    const subProcessToken: Runtime.Types.ProcessToken = subProcessTokenFacade.createProcessToken(currentProcessToken.payload);

    const flowNodeInstanceForStartEvent: Runtime.Types.FlowNodeInstance =
      flowNodeInstancesForSubprocess.find((entry: Runtime.Types.FlowNodeInstance): boolean => {
        return entry.flowNodeId === subProcessStartEvent.id;
      });

    await this._resumeSubProcessFlowNode(subProcessStartEvent,
                                         flowNodeInstanceForStartEvent,
                                         subProcessToken,
                                         subProcessTokenFacade,
                                         subProcessModelFacade,
                                         identity,
                                         flowNodeInstancesForSubprocess);

    // After all FlowNodes in the SubProcess have been executed, set the last "current" token value as a result of the whole SubProcess
    // and on the original ProcessTokenFacade, so that is is accessible by the original Process
    const subProcessTokenData: any = await subProcessTokenFacade.getOldTokenFormat();
    const subProcessResult: any = subProcessTokenData.current || {};

    return subProcessResult;
  }

  private async _resumeSubProcessFlowNode(flowNodeToResume: Model.Base.FlowNode,
                                          flowNodeInstanceForFlowNode: Runtime.Types.FlowNodeInstance,
                                          token: Runtime.Types.ProcessToken,
                                          processTokenFacade: IProcessTokenFacade,
                                          processModelFacade: IProcessModelFacade,
                                          identity: IIdentity,
                                          flowNodeInstancesForProcessInstance: Array<Runtime.Types.FlowNodeInstance>,
                                          ): Promise<NextFlowNodeInfo> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this._flowNodeHandlerFactory.create(flowNodeToResume, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo =
      await flowNodeHandler.resume(flowNodeInstanceForFlowNode, processTokenFacade, processModelFacade, identity);

    const processWasTerminated: boolean = this._processTerminatedMessage !== undefined;
    if (processWasTerminated) {
      await this.flowNodeInstanceService.persistOnTerminate(flowNodeToResume, flowNodeInstanceForFlowNode.id, token);
      throw new InternalServerError(`Process was terminated through TerminateEndEvent "${this._processTerminatedMessage.flowNodeId}".`);
    }

    const subProcessHasAnotherFlowNodeToExecute: boolean = nextFlowNodeInfo.flowNode !== undefined;
    if (!subProcessHasAnotherFlowNodeToExecute) {
      return;
    }

    // Check if a FlowNodeInstance for the next FlowNode has already been persisted
    // during a previous execution of the ProcessInstance.
    const flowNodeInstanceForNextFlowNode: Runtime.Types.FlowNodeInstance =
      flowNodeInstancesForProcessInstance.find((entry: Runtime.Types.FlowNodeInstance): boolean => {
        return entry.flowNodeId === nextFlowNodeInfo.flowNode.id;
      });

    const resumingNotFinished: boolean = flowNodeInstanceForNextFlowNode !== undefined;
    if (resumingNotFinished) {
      this.logger.info(`Resuming FlowNode ${flowNodeInstanceForNextFlowNode.flowNodeId} for SubProcess instance ${this.flowNodeInstanceId}.`);
      // If a matching FlowNodeInstance exists, continue resuming.
      await this._resumeSubProcessFlowNode(nextFlowNodeInfo.flowNode,
                                           flowNodeInstanceForNextFlowNode,
                                           nextFlowNodeInfo.token,
                                           nextFlowNodeInfo.processTokenFacade,
                                           processModelFacade,
                                           identity,
                                           flowNodeInstancesForProcessInstance);
    } else {
      // Otherwise, we will have arrived at the point at which the branch was previously interrupted,
      // and we can continue with normal execution.
      this.logger.info(`All interrupted FlowNodeInstances resumed and finished.`);
      this.logger.info(`Continuing SubProcess normally.`);
      await this._executeSubProcessFlowNode(nextFlowNodeInfo.flowNode,
                                            nextFlowNodeInfo.token,
                                            nextFlowNodeInfo.processTokenFacade,
                                            processModelFacade,
                                            identity,
                                            flowNodeInstanceForFlowNode.id);
    }

  }
}
