import * as bluebird from 'bluebird';

import {
  ICorrelationRepository,
  ICorrelationService,
  IFlowNodeInstanceRepository,
  IProcessDefinitionRepository,
  Runtime,
} from '@process-engine/process_engine_contracts';

export class CorrelationService implements ICorrelationService {
  private correlationRepository: ICorrelationRepository;
  private flowNodeInstanceRepository: IFlowNodeInstanceRepository;
  private processDefinitionRepository: IProcessDefinitionRepository;

  constructor(correlationRepository: ICorrelationRepository,
              flowNodeInstanceRepository: IFlowNodeInstanceRepository,
              processDefinitionRepository: IProcessDefinitionRepository) {

    this.correlationRepository = correlationRepository;
    this.flowNodeInstanceRepository = flowNodeInstanceRepository;
    this.processDefinitionRepository = processDefinitionRepository;
  }

  public async createEntry(correlationId: string, processModelHash: string): Promise<void> {
    return this.correlationRepository.createEntry(correlationId, processModelHash);
  }

  public async getAllActiveCorrelations(): Promise<Array<Runtime.Types.Correlation>> {

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this._getActiveFlowNodeInstances();

    const activeCorrelations: Array<Runtime.Types.Correlation> = await this._getActiveCorrelationsFromFlowNodeList(activeFlowNodeInstances);

    return activeCorrelations;
  }

  public async getByCorrelationId(correlationId: string): Promise<Runtime.Types.Correlation> {

    // These will already be sorted by their createdAt value, with the oldest one at the top.
    const correlationsFromRepo: Array<Runtime.Types.CorrelationFromRepository> = await this.correlationRepository.getByCorrelationId(correlationId);

    const correlation: Runtime.Types.Correlation = new Runtime.Types.Correlation();
    correlation.id = correlationId;
    correlation.createdAt = correlationsFromRepo[0].createdAt;
    correlation.processModels = await this._getProcessDefinitionsForCorrelation(correlationId);

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this._getActiveFlowNodeInstances();

    const correlationHasActiveFlowNodeInstances: boolean =
      activeFlowNodeInstances.some((flowNodeInstance: Runtime.Types.FlowNodeInstance): boolean => {
        return flowNodeInstance.correlationId === correlationId;
      });

    if (correlationHasActiveFlowNodeInstances) {
      correlation.state = Runtime.Types.FlowNodeInstanceState.running;
    } else {
      correlation.state = Runtime.Types.FlowNodeInstanceState.finished;
    }

    return correlation;
  }

  public async getCorrelationsForProcessModel(processModelId: string): Promise<Array<Runtime.Types.Correlation>> {
    throw new Error("Method not implemented.");
  }

  /**
   * Queries all "running" and "suspended" FlowNodeInstances from the repository
   * and returns them as a concatenated result.
   */
  private async _getActiveFlowNodeInstances(): Promise<Array<Runtime.Types.FlowNodeInstance>> {

    const runningFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this._getRunningFlowNodeInstances();

    const suspendedFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this._getSuspendedFlowNodeInstances();

    Array.prototype.push.apply(runningFlowNodeInstances, suspendedFlowNodeInstances);

    return runningFlowNodeInstances;
  }

  /**
   * Queries all running and suspended FlowNodeInstances from the repository
   * and returns them as a concatenated result.
   *
   * @async
   * @returns A list of all retrieved FlowNodeInstances.
   */
  private async _getRunningFlowNodeInstances(): Promise<Array<Runtime.Types.FlowNodeInstance>> {

    const runningState: Runtime.Types.FlowNodeInstanceState = Runtime.Types.FlowNodeInstanceState.running;

    const runningFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this.flowNodeInstanceRepository.queryByState(runningState);

    return runningFlowNodeInstances;
  }

  /**
   * Returns all running FlowNodeInstances from the repository.
   *
   * @async
   * @returns A list of all retrieved FlowNodeInstances.
   */
  private async _getSuspendedFlowNodeInstances(): Promise<Array<Runtime.Types.FlowNodeInstance>> {

    const suspendedState: Runtime.Types.FlowNodeInstanceState = Runtime.Types.FlowNodeInstanceState.suspended;

    const suspendedFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this.flowNodeInstanceRepository.queryByState(suspendedState);

    return suspendedFlowNodeInstances;
  }

  /**
   * Returns all suspended FlowNodeInstances from the repository.
   *
   * @async
   * @returns A list of all retrieved FlowNodeInstances.
   */
  private async _getActiveCorrelationsFromFlowNodeList(flowNodes: Array<Runtime.Types.FlowNodeInstance>): Promise<Array<Runtime.Types.Correlation>> {

    const correlations: Array<Runtime.Types.Correlation> = [];

    const correlationsContainsMatchingEntry: Function = (flowNodeInstance: Runtime.Types.FlowNodeInstance): boolean => {

      return correlations.some((correlation: Runtime.Types.Correlation) => {
        return correlation.id === flowNodeInstance.correlationId;
      });
    };

    for (const flowNode of flowNodes) {
      if (!correlationsContainsMatchingEntry(flowNode)) {
        const correlation: Runtime.Types.Correlation = await this._createCorrelationFromFlowNodeInstance(flowNode);
        correlations.push(correlation);
      }
    }

    return correlations;
  }

  /**
   * Creates a Correlation Object from the given FlowNodeInstance.
   *
   * @async
   * @returns The created Correlation Object.
   */
  private async _createCorrelationFromFlowNodeInstance(flowNode: Runtime.Types.FlowNodeInstance): Promise<Runtime.Types.Correlation> {

    // Note that correlationid and processModelId will be the same for all of the tokens associated with the FNI.
    // Therefore it doesn't matter which one is being used here.
    const correlation: Runtime.Types.Correlation = new Runtime.Types.Correlation();
    correlation.id = flowNode.tokens[0].correlationId;
    correlation.state = flowNode.state;
    correlation.processModels = await this._getProcessDefinitionsForCorrelation(flowNode.correlationId);

    return correlation;
  }

  /**
   * Retrieves all entries from the correlation repository that have th
   *  matching correlation ID.
   * Afterwards, the associated ProcessModelHashes are used to retrieve the
   * corresponding ProcessModels.
   *
   * @async
   * @param   correlationId The correlationId for which to get the ProcessModels.
   * @returns               The retrieved ProcessModels.
   */
  private async _getProcessDefinitionsForCorrelation(correlationId: string): Promise<Array<Runtime.Types.ProcessDefinitionFromRepository>> {

    const correlations: Array<Runtime.Types.CorrelationFromRepository> = await this.correlationRepository.getByCorrelationId(correlationId);

    const processDefinitions: Array<Runtime.Types.ProcessDefinitionFromRepository> =
      await bluebird.map(correlations, (correlation: Runtime.Types.CorrelationFromRepository) => {
        return this.processDefinitionRepository.getByHash(correlation.processModelHash);
      });

    return processDefinitions;
  }
}
