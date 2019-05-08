import {Logger} from 'loggerhythm';
import * as uuid from 'node-uuid';

import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, IFlowNodeInstanceService, ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  EndEventReachedMessage,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  ProcessTerminatedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {ProcessTokenFacade} from '../../facades/process_token_facade';

import {ActivityHandler} from './activity_handler';

interface IProcessInstanceConfig {
  processInstanceId: string;
  processModelFacade: IProcessModelFacade;
  startEvent: Model.Events.StartEvent;
  processToken: ProcessToken;
  processTokenFacade: IProcessTokenFacade;
}

export class SubProcessHandler extends ActivityHandler<Model.Activities.SubProcess> {

  private readonly flowNodeInstanceService: IFlowNodeInstanceService;

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
    this.flowNodeInstanceService = flowNodeInstanceService;
    this.logger = Logger.createLogger(`processengine:sub_process_handler:${subProcessModel.id}`);
  }

  private get subProcess(): Model.Activities.SubProcess {
    return this.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing SubProcess instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this.executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async continueAfterSuspend(
    flowNodeInstance: FlowNodeInstance,
    onSuspendToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise = new Promise<Array<Model.Base.FlowNode>>(async (resolve: Function, reject: Function): Promise<void> => {

      try {
        const flowNodeInstancesForSubProcess = await this.flowNodeInstanceService.queryByProcessModel(this.subProcess.id);

        const flowNodeInstancesForSubprocessInstance = flowNodeInstancesForSubProcess.filter((instance: FlowNodeInstance): boolean => {
          return instance.parentProcessInstanceId === flowNodeInstance.processInstanceId;
        });

        const subProcessInstanceId = flowNodeInstancesForSubprocessInstance[0].processInstanceId;

        const processInstanceConfig =
          this.createProcessInstanceConfig(processModelFacade, processTokenFacade, onSuspendToken, identity, subProcessInstanceId);

        this.onInterruptedCallback = (): void => {

          this.cancelEventAggregatorSubscriptions();
          this.sendTerminationSignalToSubProcess(subProcessInstanceId);

          return undefined;
        };

        const subProcessWasNotStarted = flowNodeInstancesForSubprocessInstance.length === 0;
        const subProcessResult = subProcessWasNotStarted
          ? await this.waitForSubProcessExecution(processInstanceConfig, identity)
          : await this.resumeSubProcess(flowNodeInstancesForSubprocessInstance, processInstanceConfig, identity);

        onSuspendToken.payload = subProcessResult;
        await this.persistOnResume(onSuspendToken);

        processTokenFacade.addResultForFlowNode(this.subProcess.id, this.flowNodeInstanceId, subProcessResult);
        await this.persistOnExit(onSuspendToken);

        const nextFlowNodes = processModelFacade.getNextFlowNodesFor(this.subProcess);

        return resolve(nextFlowNodes);
      } catch (error) {
        this.logger.error(error);

        onSuspendToken.payload = {
          error: error.message,
          additionalInformation: error.additionalInformation,
        };

        const terminationRegex = /terminated/i;
        const isTerminationMessage = terminationRegex.test(error.message);

        if (isTerminationMessage) {
          await this.persistOnTerminate(onSuspendToken);
          this.terminateProcessInstance(identity, onSuspendToken);
        } else {
          await this.persistOnError(onSuspendToken, error);
        }

        return reject(error);
      }
    });

    return handlerPromise;
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const handlerPromise = new Promise<Array<Model.Base.FlowNode>>(async (resolve: Function, reject: Function): Promise<void> => {

      const processInstanceConfig = this.createProcessInstanceConfig(processModelFacade, processTokenFacade, token, identity);

      try {
        this.onInterruptedCallback = (): void => {

          this.cancelEventAggregatorSubscriptions();
          this.sendTerminationSignalToSubProcess(processInstanceConfig.processInstanceId);

          return undefined;
        };

        await this.persistOnSuspend(token);
        const subProcessResult = await this.waitForSubProcessExecution(processInstanceConfig, identity);
        token.payload = subProcessResult;
        await this.persistOnResume(token);

        processTokenFacade.addResultForFlowNode(this.subProcess.id, this.flowNodeInstanceId, subProcessResult);
        await this.persistOnExit(token);

        const nextFlowNodes = processModelFacade.getNextFlowNodesFor(this.subProcess);

        return resolve(nextFlowNodes);
      } catch (error) {
        this.logger.error(error);

        token.payload = {
          error: error.message,
          additionalInformation: error.additionalInformation,
        };

        const terminationRegex = /terminated/i;
        const isTerminationMessage = terminationRegex.test(error.message);

        if (isTerminationMessage) {
          await this.persistOnTerminate(token);
          this.terminateProcessInstance(identity, token);
        } else {
          await this.persistOnError(token, error);
        }

        return reject(error);
      }
    });

    return handlerPromise;
  }

  private async resumeSubProcess(
    flowNodeInstancesForSubprocess: Array<FlowNodeInstance>,
    processInstanceConfig: IProcessInstanceConfig,
    identity: IIdentity,
  ): Promise<any> {

    const flowNodeInstanceForStartEvent = flowNodeInstancesForSubprocess.find((entry: FlowNodeInstance): boolean => {
      return entry.flowNodeId === processInstanceConfig.startEvent.id;
    });

    const startEventWasNotYetStarted = !flowNodeInstanceForStartEvent;
    if (startEventWasNotYetStarted) {
      return this.waitForSubProcessExecution(processInstanceConfig, identity);
    }

    return this.waitForSubProcessResumption(processInstanceConfig, identity, flowNodeInstancesForSubprocess);
  }

  private createProcessInstanceConfig(
    processModelFacade: IProcessModelFacade,
    processTokenFacade: IProcessTokenFacade,
    currentProcessToken: ProcessToken,
    identity: IIdentity,
    processInstanceId?: string,
  ): IProcessInstanceConfig {

    const subProcessModelFacade = processModelFacade.getSubProcessModelFacade(this.subProcess);

    const subProcessStartEvents = subProcessModelFacade.getStartEvents();
    const subProcessStartEvent = subProcessStartEvents[0];

    const subProcessInstanceId = processInstanceId || uuid.v4();

    const currentResults = processTokenFacade.getAllResults();

    const subProcessTokenFacade = new ProcessTokenFacade(subProcessInstanceId, this.subProcess.id, currentProcessToken.correlationId, identity);

    subProcessTokenFacade.importResults(currentResults);

    const subProcessToken = subProcessTokenFacade.createProcessToken(currentProcessToken.payload);
    subProcessToken.caller = currentProcessToken.processInstanceId;
    subProcessToken.payload = currentProcessToken.payload;

    const processInstanceConfig = {
      processInstanceId: subProcessInstanceId,
      processModelFacade: subProcessModelFacade,
      startEvent: subProcessStartEvent,
      processToken: subProcessToken,
      processTokenFacade: subProcessTokenFacade,
    };

    return processInstanceConfig;
  }

  private async waitForSubProcessExecution(
    processInstanceConfig: IProcessInstanceConfig,
    identity: IIdentity,
  ): Promise<any> {

    return new Promise<any>(async (resolve: EventReceivedCallback, reject: Function): Promise<void> => {
      try {
        const startEventHandler = await this.flowNodeHandlerFactory.create(processInstanceConfig.startEvent);

        this.subscribeToSubProcessEndEvent(processInstanceConfig.processToken, resolve);
        this.subscribeToSubProcessTermination(processInstanceConfig.processInstanceId, reject as EventReceivedCallback);

        await startEventHandler.execute(
          processInstanceConfig.processToken,
          processInstanceConfig.processTokenFacade,
          processInstanceConfig.processModelFacade,
          identity,
        );

        this.cancelEventAggregatorSubscriptions();

        return resolve();
      } catch (error) {
        this.logger.error('Failed to execute Subprocess!');
        this.logger.error(error);

        return reject(error);
      }
    });
  }

  private async waitForSubProcessResumption(
    processInstanceConfig: IProcessInstanceConfig,
    identity: IIdentity,
    flowNodeInstance: Array<FlowNodeInstance>,
  ): Promise<any> {

    return new Promise<any>(async (resolve: EventReceivedCallback, reject: Function): Promise<void> => {
      try {
        const startEventHandler = await this.flowNodeHandlerFactory.create(processInstanceConfig.startEvent);

        this.subscribeToSubProcessEndEvent(processInstanceConfig.processToken, resolve);
        this.subscribeToSubProcessTermination(processInstanceConfig.processInstanceId, reject as EventReceivedCallback);

        await startEventHandler
          .resume(flowNodeInstance, processInstanceConfig.processTokenFacade, processInstanceConfig.processModelFacade, identity);

        this.cancelEventAggregatorSubscriptions();

        return resolve();
      } catch (error) {
        this.logger.error('Failed to resume Subprocess!');
        this.logger.error(error);

        return reject(error);
      }
    });
  }

  private sendTerminationSignalToSubProcess(subProcessInstanceId: string): void {

    const subProcessTerminatedEvent = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
      .replace(eventAggregatorSettings.messageParams.processInstanceId, subProcessInstanceId);

    this.eventAggregator.publish(subProcessTerminatedEvent);
  }

  private subscribeToSubProcessEndEvent(token: ProcessToken, callback: EventReceivedCallback): void {

    const subProcessFinishedEvent = eventAggregatorSettings.messagePaths.endEventReached
      .replace(eventAggregatorSettings.messageParams.correlationId, token.correlationId)
      .replace(eventAggregatorSettings.messageParams.processModelId, token.processModelId);

    this.subProcessFinishedSubscription =
      this.eventAggregator.subscribeOnce(subProcessFinishedEvent, (message: EndEventReachedMessage): void => {
        callback(message.currentToken);
      });
  }

  private subscribeToSubProcessTermination(processInstanceId: string, callback: EventReceivedCallback): void {

    const subProcessTerminatedEvent: string = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
      .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceId);

    this.subProcessTerminatedSubscription =
      this.eventAggregator.subscribeOnce(subProcessTerminatedEvent, callback);
  }

  private terminateProcessInstance(identity: IIdentity, token: ProcessToken): void {

    const eventName = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const message = new ProcessTerminatedMessage(
      token.correlationId,
      token.processModelId,
      token.processInstanceId,
      this.flowNode.id,
      this.flowNodeInstanceId,
      identity,
      token.payload,
    );

    // ProcessInstance specific notification
    this.eventAggregator.publish(eventName, message);
    // Global notification
    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processTerminated, message);
  }

  private cancelEventAggregatorSubscriptions(): void {
    this.eventAggregator.unsubscribe(this.subProcessFinishedSubscription);
    this.eventAggregator.unsubscribe(this.subProcessTerminatedSubscription);
  }

}
