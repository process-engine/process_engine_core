import {Logger} from 'loggerhythm';
import * as uuid from 'node-uuid';

import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, IFlowNodeInstanceService, ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  EndEventReachedMessage,
  eventAggregatorSettings,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {ProcessTokenFacade} from '../facades/process_token_facade';
import {FlowNodeHandlerInterruptible} from './index';

interface IProcessInstanceConfig {
  processInstanceId: string;
  processModelFacade: IProcessModelFacade;
  startEvent: Model.Events.StartEvent;
  processToken: ProcessToken;
  processTokenFacade: IProcessTokenFacade;
}

export class SubProcessHandler extends FlowNodeHandlerInterruptible<Model.Activities.SubProcess> {

  private readonly _flowNodeInstanceService: IFlowNodeInstanceService;

  private awaitSubProcessPromise: Promise<any>;
  private subProcessFinishedSubscription: Subscription;
  private subProcessTerminatedSubscription: Subscription;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodeInstanceService: IFlowNodeInstanceService,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    subProcessModel: Model.Activities.SubProcess,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, subProcessModel);
    this._flowNodeInstanceService = flowNodeInstanceService;
    this.logger = Logger.createLogger(`processengine:sub_process_handler:${subProcessModel.id}`);
  }

  private get subProcess(): Model.Activities.SubProcess {
    return super.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing SubProcess instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise: Promise<Array<Model.Base.FlowNode>> =
      new Promise<Array<Model.Base.FlowNode>>(async(resolve: Function, reject: Function): Promise<void> => {

        try {
          const flowNodeInstancesForSubProcess: Array<FlowNodeInstance> =
            await this._flowNodeInstanceService.queryByProcessModel(this.subProcess.id);

          const flowNodeInstancesForSubprocessInstance: Array<FlowNodeInstance> =
            flowNodeInstancesForSubProcess.filter((instance: FlowNodeInstance) => {
              return instance.parentProcessInstanceId = flowNodeInstance.processInstanceId;
            });

          const subProcessInstanceId: string = flowNodeInstancesForSubprocessInstance[0].processInstanceId;

          const processInstanceConfig: IProcessInstanceConfig =
            this._createProcessInstanceConfig(processModelFacade, processTokenFacade, onSuspendToken, identity, subProcessInstanceId);

          this.onInterruptedCallback = (): void => {

            this._cancelEventAggregatorSubscriptions();
            this._sendTerminationSignalToSubProcess(subProcessInstanceId);

            return;
          };

          const subProcessWasNotStarted: boolean = flowNodeInstancesForSubprocessInstance.length === 0;
          const subProcessResult: any = subProcessWasNotStarted
            ? await this._executeSubprocess(processInstanceConfig, identity)
            : await this._resumeSubProcess(flowNodeInstancesForSubprocessInstance, processInstanceConfig, identity);

          onSuspendToken.payload = subProcessResult;
          await this.persistOnResume(onSuspendToken);

          processTokenFacade.addResultForFlowNode(this.subProcess.id, this.flowNodeInstanceId, subProcessResult);
          await this.persistOnExit(onSuspendToken);

          const nextFlowNodes: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.subProcess);

          resolve(nextFlowNodes);
        } catch (error) {
          this.logger.error(error);

          onSuspendToken.payload = {
            error: error.message,
            additionalInformation: error.additionalInformation,
          };

          const terminationRegex: RegExp = /terminated/i;
          const isTerminationMessage: boolean = terminationRegex.test(error.message);

          if (isTerminationMessage) {
            await this.persistOnTerminate(onSuspendToken);
          } else {
            await this.persistOnError(onSuspendToken, error);
          }

          return reject(error);
        }
      });

    return handlerPromise;
  }

  protected async _executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise: Promise<Array<Model.Base.FlowNode>> =
      new Promise<Array<Model.Base.FlowNode>>(async(resolve: Function, reject: Function): Promise<void> => {

        const processInstanceConfig: IProcessInstanceConfig =
          this._createProcessInstanceConfig(processModelFacade, processTokenFacade, token, identity);

        try {
          this.onInterruptedCallback = (): void => {

            this._cancelEventAggregatorSubscriptions();
            this._sendTerminationSignalToSubProcess(processInstanceConfig.processInstanceId);

            return;
          };

          await this.persistOnSuspend(token);
          const subProcessResult: any = await this._executeSubprocess(processInstanceConfig, identity);
          token.payload = subProcessResult;
          await this.persistOnResume(token);

          processTokenFacade.addResultForFlowNode(this.subProcess.id, this.flowNodeInstanceId, subProcessResult);
          await this.persistOnExit(token);

          const nextFlowNodes: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.subProcess);

          return resolve(nextFlowNodes);
        } catch (error) {
          this.logger.error(error);

          token.payload = {
            error: error.message,
            additionalInformation: error.additionalInformation,
          };

          const terminationRegex: RegExp = /terminated/i;
          const isTerminationMessage: boolean = terminationRegex.test(error.message);

          if (isTerminationMessage) {
            await this.persistOnTerminate(token);
          } else {
            await this.persistOnError(token, error);
          }

          return reject(error);
        }
      });

    return handlerPromise;
  }

  private async _executeSubprocess(processInstanceConfig: IProcessInstanceConfig, identity: IIdentity): Promise<any> {

    this.awaitSubProcessPromise = this._waitForSubProcessExecution(processInstanceConfig, identity);

    return await this.awaitSubProcessPromise;
  }

  private async _resumeSubProcess(
    flowNodeInstancesForSubprocess: Array<FlowNodeInstance>,
    processInstanceConfig: IProcessInstanceConfig,
    identity: IIdentity,
  ): Promise<any> {

    const flowNodeInstanceForStartEvent: FlowNodeInstance =
      flowNodeInstancesForSubprocess.find((entry: FlowNodeInstance): boolean => {
        return entry.flowNodeId === processInstanceConfig.startEvent.id;
      });

    const startEventWasNotYetStarted: boolean = !flowNodeInstanceForStartEvent;
    if (startEventWasNotYetStarted) {
      this.awaitSubProcessPromise = this._waitForSubProcessExecution(processInstanceConfig, identity);

      return await this.awaitSubProcessPromise;
    }

    this.awaitSubProcessPromise = this._waitForSubProcessResumption(processInstanceConfig, identity, flowNodeInstancesForSubprocess);

    return await this.awaitSubProcessPromise;
  }

  private _createProcessInstanceConfig(
    processModelFacade: IProcessModelFacade,
    processTokenFacade: IProcessTokenFacade,
    currentProcessToken: ProcessToken,
    identity: IIdentity,
    processInstanceId?: string,
  ): IProcessInstanceConfig {

    const subProcessModelFacade: IProcessModelFacade = processModelFacade.getSubProcessModelFacade(this.subProcess);

    const subProcessStartEvents: Array<Model.Events.StartEvent> = subProcessModelFacade.getStartEvents();
    const subProcessStartEvent: Model.Events.StartEvent = subProcessStartEvents[0];

    const subProcessInstanceId: string = processInstanceId || uuid.v4();

    const currentResults: any = processTokenFacade.getAllResults();

    const subProcessTokenFacade: IProcessTokenFacade =
      new ProcessTokenFacade(subProcessInstanceId, this.subProcess.id, currentProcessToken.correlationId, identity);

    subProcessTokenFacade.importResults(currentResults);

    const subProcessToken: ProcessToken = subProcessTokenFacade.createProcessToken(currentProcessToken.payload);
    subProcessToken.caller = currentProcessToken.processInstanceId;
    subProcessToken.payload = currentProcessToken.payload;

    const processInstanceConfig: IProcessInstanceConfig = {
      processInstanceId: subProcessInstanceId,
      processModelFacade: subProcessModelFacade,
      startEvent: subProcessStartEvent,
      processToken: subProcessToken,
      processTokenFacade: subProcessTokenFacade,
    };

    return processInstanceConfig;
  }

  private async _waitForSubProcessExecution(
    processInstanceConfig: IProcessInstanceConfig,
    identity: IIdentity,
  ): Promise<any> {

    return new Promise<any>(async(resolve: EventReceivedCallback, reject: Function): Promise<void> => {
      try {
        const startEventHandler: IFlowNodeHandler<Model.Base.FlowNode> =
          await this.flowNodeHandlerFactory.create(processInstanceConfig.startEvent);

        this._subscribeToSubProcessEndEvent(processInstanceConfig.processToken, resolve);
        this._subscribeToSubProcessTermination(processInstanceConfig.processInstanceId, reject as EventReceivedCallback);

        await startEventHandler.execute(processInstanceConfig.processToken,
                                        processInstanceConfig.processTokenFacade,
                                        processInstanceConfig.processModelFacade,
                                        identity);

        this._cancelEventAggregatorSubscriptions();

        return resolve();
      } catch (error) {
        this.logger.error('Failed to execute Subprocess!');
        this.logger.error(error);

        return reject(error);
      }
    });
  }

  private async _waitForSubProcessResumption(
    processInstanceConfig: IProcessInstanceConfig,
    identity: IIdentity,
    flowNodeInstance: Array<FlowNodeInstance>,
  ): Promise<any> {

    return new Promise<any>(async(resolve: EventReceivedCallback, reject: Function): Promise<void> => {
      try {
        const startEventHandler: IFlowNodeHandler<Model.Base.FlowNode> =
          await this.flowNodeHandlerFactory.create(processInstanceConfig.startEvent);

        this._subscribeToSubProcessEndEvent(processInstanceConfig.processToken, resolve);
        this._subscribeToSubProcessTermination(processInstanceConfig.processInstanceId, reject as EventReceivedCallback);

        await startEventHandler
          .resume(flowNodeInstance, processInstanceConfig.processTokenFacade, processInstanceConfig.processModelFacade, identity);

        this._cancelEventAggregatorSubscriptions();

        return resolve();
      } catch (error) {
        this.logger.error('Failed to execute Subprocess!');
        this.logger.error(error);

        return reject(error);
      }
    });
  }

  private _sendTerminationSignalToSubProcess(subProcessInstanceId: string): void {

    const subProcessTerminatedEvent: string = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
      .replace(eventAggregatorSettings.messageParams.processInstanceId, subProcessInstanceId);

    this.eventAggregator.publish(subProcessTerminatedEvent);
  }

  private _subscribeToSubProcessEndEvent(token: ProcessToken, callback: EventReceivedCallback): void {

    const subProcessFinishedEvent: string = eventAggregatorSettings.messagePaths.endEventReached
      .replace(eventAggregatorSettings.messageParams.correlationId, token.correlationId)
      .replace(eventAggregatorSettings.messageParams.processModelId, token.processModelId);

    this.subProcessFinishedSubscription =
      this.eventAggregator.subscribeOnce(subProcessFinishedEvent, (message: EndEventReachedMessage): void => {
        callback(message.currentToken);
      });
  }

  private _subscribeToSubProcessTermination(processInstanceId: string, callback: EventReceivedCallback): void {

    const subProcessTerminatedEvent: string = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceId);

    this.subProcessTerminatedSubscription =
      this.eventAggregator.subscribeOnce(subProcessTerminatedEvent, callback);
  }

  private _cancelEventAggregatorSubscriptions(): void {
    this.eventAggregator.unsubscribe(this.subProcessFinishedSubscription);
    this.eventAggregator.unsubscribe(this.subProcessTerminatedSubscription);
  }
}
