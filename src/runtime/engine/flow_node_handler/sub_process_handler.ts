import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';
import * as uuid from 'node-uuid';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {
  eventAggregatorSettings,
  IFlowNodeHandler,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  Runtime,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {ProcessTokenFacade} from '../process_token_facade';
import {FlowNodeHandlerInterruptible} from './index';

export class SubProcessHandler extends FlowNodeHandlerInterruptible<Model.Activities.SubProcess> {

  private _eventAggregator: IEventAggregator;
  private _processTerminatedMessage: TerminateEndEventReachedMessage;

  private terminateEndEventSubscription: Subscription;

  constructor(container: IContainer, eventAggregator: IEventAggregator, subProcessModel: Model.Activities.SubProcess) {
    super(container, subProcessModel);

    this._eventAggregator = eventAggregator;
    this.logger = Logger.createLogger(`processengine:sub_process_handler:${subProcessModel.id}`);
  }

  private get subProcess(): Model.Activities.SubProcess {
    return super.flowNode;
  }

  // TODO: We can't interrupt a Subprocess yet, so this will remain inactive.
  public interrupt(token: Runtime.Types.ProcessToken, terminate?: boolean): Promise<void> {
    return Promise.resolve();
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Model.Base.FlowNode> {

    this.logger.verbose(`Executing SubProcess instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _continueAfterSuspend(
    flowNodeInstance: Runtime.Types.FlowNodeInstance,
    onSuspendToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Model.Base.FlowNode> {

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

    return this.getNextFlowNodeInfo(processModelFacade);
  }

  protected async _executeHandler(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Model.Base.FlowNode> {

    this._subscribeToProcessTerminatedEvent(token.processInstanceId);

    await this.persistOnSuspend(token);
    const subProcessResult: any = await this._executeSubprocess(token, processTokenFacade, processModelFacade, identity);
    token.payload = subProcessResult;
    await this.persistOnResume(token);

    processTokenFacade.addResultForFlowNode(this.subProcess.id, subProcessResult);
    await this.persistOnExit(token);

    this._eventAggregator.unsubscribe(this.terminateEndEventSubscription);

    return this.getNextFlowNodeInfo(processModelFacade);
  }

  private _subscribeToProcessTerminatedEvent(processInstanceId: string): void {

    const processTerminatedEvent: string = eventAggregatorSettings.messagePaths.terminateEndEventReached
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceId);

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

    try {
      const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> =
        await this.flowNodeHandlerFactory.create(subProcessStartEvent, processModelFacade);

      await flowNodeHandler.execute(subProcessToken, subProcessTokenFacade, subProcessModelFacade, identity);

      // After all FlowNodes in the SubProcess have been executed, set the last "current" token value as a result of the whole SubProcess
      // and on the original ProcessTokenFacade, so that is is accessible by the original Process
      const subProcessTokenData: any = await subProcessTokenFacade.getOldTokenFormat();
      const subProcessResult: any = subProcessTokenData.current || {};

      return subProcessResult;
    } catch (error) {
      // We must change the state of the Subprocess here, or it will remain in a suspended state forever.
      this.logger.error(error);

      await this.persistOnError(currentProcessToken, error);

      throw error;
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

    // TODO - WIP
    // Still needs refactoring

    // await this._resumeSubProcessFlowNode(subProcessStartEvent,
    //                                      flowNodeInstanceForStartEvent,
    //                                      subProcessToken,
    //                                      subProcessTokenFacade,
    //                                      subProcessModelFacade,
    //                                      identity,
    //                                      flowNodeInstancesForSubprocess);

    // After all FlowNodes in the SubProcess have been executed, set the last "current" token value as a result of the whole SubProcess
    // and on the original ProcessTokenFacade, so that is is accessible by the original Process
    const subProcessTokenData: any = await subProcessTokenFacade.getOldTokenFormat();
    const subProcessResult: any = subProcessTokenData.current || {};

    return subProcessResult;
  }
}
