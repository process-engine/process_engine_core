import {Logger} from 'loggerhythm';

import {InternalServerError} from '@essential-projects/errors_ts';
import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {Correlation, CorrelationProcessInstance, ICorrelationService} from '@process-engine/correlation.contracts';
import {
  FlowNodeInstance,
  FlowNodeInstanceState,
  IFlowNodeInstanceService,
  ProcessToken,
  ProcessTokenType,
} from '@process-engine/flow_node_instance.contracts';
import {
  EndEventReachedMessage,
  eventAggregatorSettings,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceResult,
  IModelParser,
  IProcessModelFacade,
  IProcessTokenFacade,
  IResumeProcessService,
} from '@process-engine/process_engine_contracts';
import {BpmnType, Model} from '@process-engine/process_model.contracts';

import {ProcessInstanceStateHandlingFacade} from './facades/process_instance_state_handling_facade';
import {ProcessModelFacade} from './facades/process_model_facade';
import {ProcessTokenFacade} from './facades/process_token_facade';

import {IProcessInstanceConfig} from './facades/iprocess_instance_config';

const logger: Logger = new Logger('processengine:runtime:resume_process_service');

interface IProcessInstanceModelAssociation {
  processModelId: string;
  processInstanceId: string;
  processInstanceOwner: IIdentity;
}

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

  private readonly _bpmnModelParser: IModelParser;
  private readonly _correlationService: ICorrelationService;
  private readonly _eventAggregator: IEventAggregator;
  private readonly _flowNodeHandlerFactory: IFlowNodeHandlerFactory;
  private readonly _flowNodeInstanceService: IFlowNodeInstanceService;
  private readonly _processInstanceStateHandlingFacade: ProcessInstanceStateHandlingFacade;

  constructor(
    bpmnModelParser: IModelParser,
    correlationService: ICorrelationService,
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodeInstanceService: IFlowNodeInstanceService,
    processInstanceStateHandlingFacade: ProcessInstanceStateHandlingFacade,
  ) {
    this._bpmnModelParser = bpmnModelParser;
    this._correlationService = correlationService;
    this._eventAggregator = eventAggregator,
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._processInstanceStateHandlingFacade = processInstanceStateHandlingFacade;
  }

  public async findAndResumeInterruptedProcessInstances(identity: IIdentity): Promise<void> {

    logger.info('Resuming ProcessInstances that were not yet finished.');

    // First get all active FlowNodeInstances from every ProcessInstance.
    const activeFlowNodeInstances: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.queryActive();

    // Now get the unique ProcessInstanceIds and ProcessModelIds from the list.
    const activeProcessInstances: Array<IProcessInstanceModelAssociation> =
      this._findProcessInstancesFromFlowNodeList(activeFlowNodeInstances);

    logger.verbose(`Found ${activeProcessInstances.length} ProcessInstances to resume.`);

    for (const processInstance of activeProcessInstances) {
      // Do not await this, to avoid possible issues with Inter-Process communication.
      //
      // Lets say, Process A sends signals/messages to Process B,
      // then these processes must run in concert, not sequentially.
      this.resumeProcessInstanceById(processInstance.processInstanceOwner, processInstance.processModelId, processInstance.processInstanceId);
    }
  }

  public async resumeProcessInstanceById(identity: IIdentity, processModelId: string, processInstanceId: string): Promise<EndEventReachedMessage> {

    logger.info(`Attempting to resume ProcessInstance with instance ID ${processInstanceId} and model ID ${processModelId}`);

    const flowNodeInstancesForProcessInstance: Array<FlowNodeInstance> =
      await this._flowNodeInstanceService.queryByProcessInstance(processInstanceId);

    // ----
    // First check if there even are any FlowNodeInstances still active for the ProcessInstance.
    // There is no point in trying to resume anything that's already finished.
    const processHasActiveFlowNodeInstances: boolean =
      flowNodeInstancesForProcessInstance.some((entry: FlowNodeInstance): boolean => {
        return entry.state === FlowNodeInstanceState.running ||
               entry.state === FlowNodeInstanceState.suspended;
      });

    if (!processHasActiveFlowNodeInstances) {
      logger.info(`ProcessInstance ${processInstanceId} is not active anymore.`);

      return;
    }

    return new Promise<EndEventReachedMessage>(async(resolve: Function, reject: Function): Promise<void> => {

      try {
        const processInstanceConfig: IProcessInstanceConfig =
          await this._createProcessInstanceConfig(identity, processInstanceId, flowNodeInstancesForProcessInstance);

        const processEndMessageName: string = eventAggregatorSettings.messagePaths.endEventReached
          .replace(eventAggregatorSettings.messageParams.correlationId, processInstanceConfig.correlationId)
          .replace(eventAggregatorSettings.messageParams.processModelId, processModelId);

        let eventSubscription: Subscription;

        const messageReceivedCallback: EventReceivedCallback = async(message: EndEventReachedMessage): Promise<void> => {
          this._eventAggregator.unsubscribe(eventSubscription);
          resolve(message);
        };

        eventSubscription = this._eventAggregator.subscribe(processEndMessageName, messageReceivedCallback);

        await this._resumeProcessInstance(identity, processInstanceConfig, flowNodeInstancesForProcessInstance);
      } catch (error) {
        // Errors from @essential-project and ErrorEndEvents are thrown as they are.
        // Everything else is thrown as an InternalServerError.
        const isPresetError: boolean = error.code && error.name;
        if (isPresetError) {
          return reject(error);
        }

        reject(new InternalServerError(error.message));
      }
    });
  }

  private async _createProcessInstanceConfig(
    identity: IIdentity,
    processInstanceId: string,
    flowNodeInstances: Array<FlowNodeInstance>,
  ): Promise<IProcessInstanceConfig> {

    const correlation: Correlation = await this._correlationService.getByProcessInstanceId(identity, processInstanceId);

    const processModelCorrelation: CorrelationProcessInstance = correlation.processModels[0];

    const processModelDefinitions: Model.Definitions = await this._bpmnModelParser.parseXmlToObjectModel(processModelCorrelation.xml);
    const processModel: Model.Process = processModelDefinitions.processes[0];
    const processModelFacade: IProcessModelFacade = new ProcessModelFacade(processModel);

    // Find the StartEvent the ProcessInstance was started with.
    const startEventInstance: FlowNodeInstance =
      flowNodeInstances.find((instance: FlowNodeInstance): boolean => {
        return instance.flowNodeType === BpmnType.startEvent;
      });

    const startEvent: Model.Events.StartEvent = processModelFacade.getStartEventById(startEventInstance.flowNodeId);

    // The initial ProcessToken will always be the payload that the StartEvent first received.
    const initialToken: ProcessToken =
      startEventInstance.tokens.find((token: ProcessToken): boolean => {
        return token.type === ProcessTokenType.onEnter;
      });

    const processTokenFacade: IProcessTokenFacade =
      new ProcessTokenFacade(processInstanceId, processModel.id, startEventInstance.correlationId, identity);

    const processToken: ProcessToken = processTokenFacade.createProcessToken(initialToken.payload);
    processToken.payload = initialToken.payload;

    const processInstanceConfig: IProcessInstanceConfig = {
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

  private async _resumeProcessInstance(
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
      this._processInstanceStateHandlingFacade.logProcessResumed(correlationId, processModelId, processInstanceId);

      const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> =
        await this._flowNodeHandlerFactory.create(processInstanceConfig.startEvent);

      logger.info(`Resuming ProcessInstance with instance ID ${processInstanceId} and model ID ${processModelId}...`);

      await flowNodeHandler.resume(
        flowNodeInstances,
        processInstanceConfig.processTokenFacade,
        processInstanceConfig.processModelFacade,
        identity,
      );

      const allResults: Array<IFlowNodeInstanceResult> = await processInstanceConfig.processTokenFacade.getAllResults();
      const resultToken: IFlowNodeInstanceResult = allResults.pop();

      const terminateEvent: string = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
        .replace(eventAggregatorSettings.messageParams.processInstanceId, processInstanceConfig.processInstanceId);

      this._eventAggregator.subscribeOnce(terminateEvent, async() => {
        throw new InternalServerError('Process was terminated!');
      });

      await this._processInstanceStateHandlingFacade.finishProcessInstanceInCorrelation(identity, processInstanceConfig, resultToken);
    } catch (error) {
      await this._processInstanceStateHandlingFacade.finishProcessInstanceInCorrelationWithError(identity, processInstanceConfig, error);

      throw error;
    }
  }

  /**
   * Takes a list of FlowNodeInstances and picks out the unique ProcessModelIds
   * and ProcessInstanceIds from each.
   *
   * Each Id is only stored once, to account for ProcessInstances with parallel
   * running branches.
   *
   * Also, Subprocesses must be filtered out, because these are always handled
   * by a CallActivityHandler or SubProcessHandler.
   *
   * @param   activeFlowNodeInstances The list of FlowNodeInstances from which
   *                                  to get a list of ProcessInstances.
   * @returns                         The list of ProcessInstances.
   */
  private _findProcessInstancesFromFlowNodeList(
    activeFlowNodeInstances: Array<FlowNodeInstance>,
  ): Array<IProcessInstanceModelAssociation> {

    const activeProcessInstances: Array<IProcessInstanceModelAssociation> = [];

    for (const flowNodeInstance of activeFlowNodeInstances) {
      // Store each processInstanceId and processModelId only once,
      // to account for processes with ParallelGateways.
      const processInstanceListHasNoMatchingEntry: boolean =
        !activeProcessInstances.some((entry: IProcessInstanceModelAssociation): boolean => {
          return entry.processInstanceId === flowNodeInstance.processInstanceId;
        });
      const flowNodeInstanceIsNotPartOfSubprocess: boolean = !flowNodeInstance.parentProcessInstanceId;

      if (processInstanceListHasNoMatchingEntry && flowNodeInstanceIsNotPartOfSubprocess) {
        const newAssociation: IProcessInstanceModelAssociation = {
          processInstanceId: flowNodeInstance.processInstanceId,
          processModelId: flowNodeInstance.processModelId,
          processInstanceOwner: flowNodeInstance.owner,
        };
        activeProcessInstances.push(newAssociation);
      }
    }

    return activeProcessInstances;
  }
}
