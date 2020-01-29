import {Logger} from 'loggerhythm';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {
  BpmnType,
  CorrelationState,
  FlowNodeInstance,
  FlowNodeInstanceState,
  ICorrelationService,
  IFlowNodeInstanceService,
  ProcessToken,
  ProcessTokenType,
} from '@process-engine/persistence_api.contracts';

import {
  EndEventReachedMessage,
  IFlowNodeHandlerFactory,
  IModelParser,
  IResumeProcessService,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';

import {ProcessInstanceStateHandlingFacade} from './facades/process_instance_state_handling_facade';
import {ProcessModelFacade} from './facades/process_model_facade';
import {ProcessTokenFacade} from './facades/process_token_facade';

import {IProcessInstanceConfig} from './facades/iprocess_instance_config';

const logger = new Logger('processengine:runtime:resume_process_service');

/**
 * This service is designed to find and resume ProcessInstances that were
 * interrupted during a previous lifecycle of the ProcessEngine.
 *
 * It is strongly encouraged to only run this service ONCE when starting up
 * the ProcessEngine!
 *
 * Trying to resume ProcessInstances during normal operation will have
 * unpredictable consequences!
 */
export class ResumeProcessService implements IResumeProcessService {

  private readonly bpmnModelParser: IModelParser;
  private readonly correlationService: ICorrelationService;
  private readonly eventAggregator: IEventAggregator;
  private readonly flowNodeHandlerFactory: IFlowNodeHandlerFactory;
  private readonly flowNodeInstanceService: IFlowNodeInstanceService;
  private readonly processInstanceStateHandlingFacade: ProcessInstanceStateHandlingFacade;

  constructor(
    bpmnModelParser: IModelParser,
    correlationService: ICorrelationService,
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodeInstanceService: IFlowNodeInstanceService,
    processInstanceStateHandlingFacade: ProcessInstanceStateHandlingFacade,
  ) {
    this.bpmnModelParser = bpmnModelParser;
    this.correlationService = correlationService;
    this.eventAggregator = eventAggregator;
    this.flowNodeHandlerFactory = flowNodeHandlerFactory;
    this.flowNodeInstanceService = flowNodeInstanceService;
    this.processInstanceStateHandlingFacade = processInstanceStateHandlingFacade;
  }

  public async findAndResumeInterruptedProcessInstances(identity: IIdentity): Promise<void> {

    logger.info('Resuming ProcessInstances that were not yet finished.');

    // First get all active FlowNodeInstances from every ProcessInstance.
    const activeProcessInstances = await this.correlationService.getProcessInstancesByState(identity, CorrelationState.running);

    logger.verbose(`Found ${activeProcessInstances.length} ProcessInstances to resume.`);

    for (const processInstance of activeProcessInstances) {
      // Do not await this, to avoid possible issues with Inter-Process communication.
      //
      // Lets say, Process A sends signals/messages to Process B,
      // then these processes must run in concert, not sequentially.
      this.resumeProcessInstanceById(processInstance.identity, processInstance.processModelId, processInstance.processInstanceId);
    }
  }

  public async resumeProcessInstanceById(
    identity: IIdentity,
    processModelId: string,
    processInstanceId: string,
  ): Promise<EndEventReachedMessage | void> {

    logger.info(`Attempting to resume ProcessInstance with instance ID ${processInstanceId} and model ID ${processModelId}`);

    const processInstance = await this.correlationService.getByProcessInstanceId(identity, processInstanceId);

    // Safeguard, for when this function is called by CallActivities.
    if (processInstance.state !== CorrelationState.running) {
      logger.info(`ProcessInstance ${processInstanceId} is already finished.`);
      return Promise.resolve();
    }

    const flowNodeInstancesForProcessInstance = await this.flowNodeInstanceService.queryByProcessInstance(processInstanceId);

    const hasActiveFlowNodeInstances = flowNodeInstancesForProcessInstance.some((entry) => {
      return entry.state === FlowNodeInstanceState.running || entry.state === FlowNodeInstanceState.suspended;
    });

    const hasReachedAnEndEvent = flowNodeInstancesForProcessInstance.some((entry) => entry.flowNodeType === BpmnType.endEvent);

    // If no FlowNodeInstances are active anymore and at least one EndEvent was reached,
    // we are dealing with an orphaned ProcessInstance that we have to finish manually.
    const processInstanceIsOrphaned = !hasActiveFlowNodeInstances && hasReachedAnEndEvent;
    if (processInstanceIsOrphaned) {
      logger.warn(`ProcessInstance ${processInstanceId} is not active anymore. It is likely something went wrong during final state transition.`);
      logger.warn(`Setting orphaned ProcessInstance ${processInstanceId} state to "finished", so it won't show up again.`);
      return this.finishOrphanedProcessInstance(identity, flowNodeInstancesForProcessInstance, processInstanceId);
    }

    return new Promise<EndEventReachedMessage>(async (resolve: Function, reject: Function): Promise<void> => {

      try {
        const processInstanceConfig = await this.createProcessInstanceConfig(identity, processInstanceId, flowNodeInstancesForProcessInstance);

        const processEndMessageName = eventAggregatorSettings.messagePaths.endEventReached
          .replace(eventAggregatorSettings.messageParams.correlationId, processInstanceConfig.correlationId)
          .replace(eventAggregatorSettings.messageParams.processModelId, processModelId);

        let eventSubscription: Subscription;

        const messageReceivedCallback = async (message: EndEventReachedMessage): Promise<void> => {
          this.eventAggregator.unsubscribe(eventSubscription);
          resolve(message);
        };

        eventSubscription = this.eventAggregator.subscribe(processEndMessageName, messageReceivedCallback);

        await this.resumeProcessInstance(identity, processInstanceConfig, flowNodeInstancesForProcessInstance);
      } catch (error) {
        // Errors from @essential-project and ErrorEndEvents are thrown as they are.
        // Everything else is thrown as an InternalServerError.
        const isPresetError = error.code && error.name;
        if (isPresetError) {
          reject(error);
        } else {
          reject(new InternalServerError(error.message));
        }
      }
    });
  }

  private async createProcessInstanceConfig(
    identity: IIdentity,
    processInstanceId: string,
    flowNodeInstances: Array<FlowNodeInstance>,
  ): Promise<IProcessInstanceConfig> {

    const processInstance = await this.correlationService.getByProcessInstanceId(identity, processInstanceId);

    const processModelDefinitions = await this.bpmnModelParser.parseXmlToObjectModel(processInstance.xml);
    const processModel = processModelDefinitions.processes[0];
    const processModelFacade = new ProcessModelFacade(processModel);

    // Find the StartEvent the ProcessInstance was started with.
    const startEventInstance = flowNodeInstances.find((instance: FlowNodeInstance): boolean => {
      return instance.flowNodeType === BpmnType.startEvent;
    });

    const startEvent = processModelFacade.getStartEventById(startEventInstance.flowNodeId);

    // The initial ProcessToken will always be the payload that the StartEvent first received.
    const initialToken = startEventInstance.tokens.find((token: ProcessToken): boolean => {
      return token.type === ProcessTokenType.onEnter;
    });

    const processTokenFacade = new ProcessTokenFacade(processInstanceId, processModel.id, startEventInstance.correlationId, identity);

    const processToken = processTokenFacade.createProcessToken(initialToken.payload);
    processToken.payload = initialToken.payload;

    const processInstanceConfig = {
      correlationId: startEventInstance.correlationId,
      processModelId: processModel.id,
      processInstanceId: processInstanceId,
      processModelFacade: processModelFacade,
      startEvent: startEvent,
      startEventInstance: startEventInstance,
      processToken: processToken,
      processTokenFacade: processTokenFacade,
    };

    return processInstanceConfig;
  }

  private async resumeProcessInstance(
    identity: IIdentity,
    processInstanceConfig: IProcessInstanceConfig,
    flowNodeInstances: Array<FlowNodeInstance>,
  ): Promise<void> {

    const {correlationId, processInstanceId, processModelId} = processInstanceConfig;

    try {
      // Resume the ProcessInstance from the StartEvent it was originally started with.
      // The ProcessInstance will retrace all its steps until it ends up at the FlowNode it was interrupted at.
      // This removes the need for us to reconstruct the ProcessToken manually, or trace any parallel running branches,
      // because the FlowNodeHandlers will do that for us.
      // When we reached the interrupted FlowNodeInstance and finished resuming it, the ProcessInstance will
      // continue to run normally; i.e. all following FlowNodes will be 'executed' and no longer 'resumed'.
      this.processInstanceStateHandlingFacade.logProcessResumed(correlationId, processModelId, processInstanceId);

      const flowNodeHandler = await this.flowNodeHandlerFactory.create(processInstanceConfig.startEvent);

      const flowNodeInstance = flowNodeInstances.find((entry: FlowNodeInstance): boolean => {
        return entry.flowNodeId === processInstanceConfig.startEvent.id;
      });

      logger.info(`Resuming ProcessInstance with instance ID ${processInstanceId} and model ID ${processModelId}...`);

      await flowNodeHandler.resume(
        flowNodeInstance,
        flowNodeInstances,
        processInstanceConfig.processTokenFacade,
        processInstanceConfig.processModelFacade,
        identity,
      );

      const allResults = await processInstanceConfig.processTokenFacade.getAllResults();
      const resultToken = allResults.pop();

      const terminateEvent = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
        .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceConfig.processInstanceId);

      this.eventAggregator.subscribeOnce(terminateEvent, (): void => {
        throw new InternalServerError('Process was terminated!');
      });

      await this.processInstanceStateHandlingFacade.finishProcessInstance(identity, processInstanceConfig, resultToken);
    } catch (error) {
      await this.processInstanceStateHandlingFacade.finishProcessInstanceWithError(identity, processInstanceConfig, error);

      throw error;
    }
  }

  private async finishOrphanedProcessInstance(
    identity: IIdentity,
    flowNodeInstances: Array<FlowNodeInstance>,
    processInstanceId: string,
  ): Promise<EndEventReachedMessage> {

    const processInstance = await this.correlationService.getByProcessInstanceId(identity, processInstanceId);

    const finalFlowNode = this.getFinalFlowNodeForOrphanedProcessInstance(flowNodeInstances);
    const finalToken = finalFlowNode?.getTokenByType(ProcessTokenType.onExit)?.payload ?? {};

    const processFinishedWithError =
      finalFlowNode?.state === FlowNodeInstanceState.error ||
      finalFlowNode?.state === FlowNodeInstanceState.terminated;

    if (processFinishedWithError) {
      // Default error is used, if, for whatever reasons, no error is attached to the FlowNodeInstance.
      // This was possible in older versions of the ProcessEngine.
      const errorToUse = finalFlowNode.error ?? new InternalServerError('Process was terminated!');

      await this
        .correlationService
        // TODO: Fix type of `FlowNodeInstance.error` property
        .finishProcessInstanceInCorrelationWithError(identity, processInstance.correlationId, processInstanceId, errorToUse as any);

    } else {

      await this
        .correlationService
        .finishProcessInstanceInCorrelation(identity, processInstance.correlationId, processInstanceId);
    }

    const result = new EndEventReachedMessage(
      processInstance.correlationId,
      processInstance.processModelId,
      processInstanceId,
      finalFlowNode?.flowNodeId,
      finalFlowNode?.id,
      processInstance.identity,
      finalToken,
      finalFlowNode?.flowNodeName,
    );

    return result;
  }

  private getFinalFlowNodeForOrphanedProcessInstance(flowNodeInstances: Array<FlowNodeInstance>): FlowNodeInstance {

    // Check if the Instance was finished regularly by an EndEvent
    const endEvent = flowNodeInstances.find((fni): boolean => fni.flowNodeType === BpmnType.endEvent);
    if (endEvent) {
      return endEvent;
    }

    // Check for ProcessTermination
    const terminatedFlowNode = flowNodeInstances.find((fni): boolean => fni.state === FlowNodeInstanceState.terminated);
    if (terminatedFlowNode) {
      return terminatedFlowNode;
    }

    // Check for Errors
    const erroredFlowNode = flowNodeInstances.find((fni): boolean => fni.state === FlowNodeInstanceState.error);

    return erroredFlowNode;
  }

}
