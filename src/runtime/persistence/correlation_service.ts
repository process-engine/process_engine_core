import * as bluebird from 'bluebird';

import {
  ICorrelationRepository,
  ICorrelationService,
  IFlowNodeInstanceRepository,
  IProcessDefinitionRepository,
  Runtime,
} from '@process-engine/process_engine_contracts';

/**
 * Groups ProcessModelHashes by their associated CorrelationId.
 *
 * Only use internally.
 */
type GroupedProcessModelHashes = {
  [correlationId: string]: Array<string>,
};

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

  public async createEntry(correlationId: string, processInstanceId: string, processModelId: string, processModelHash: string): Promise<void> {
    return this.correlationRepository.createEntry(correlationId, processInstanceId, processModelId, processModelHash);
  }

  public async getAllActiveCorrelations(): Promise<Array<Runtime.Types.Correlation>> {

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this._getActiveFlowNodeInstances();

    const activeCorrelations: Array<Runtime.Types.Correlation> = await this._getActiveCorrelationsFromFlowNodeList(activeFlowNodeInstances);

    return activeCorrelations;
  }

  public async getAll(): Promise<Array<Runtime.Types.Correlation>> {

    const correlationsFromRepo: Array<Runtime.Types.CorrelationFromRepository> = await this.correlationRepository.getAll();

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this._getActiveFlowNodeInstances();

    const groupedProcessModelhashes: GroupedProcessModelHashes = this._groupProcessModelHashes(correlationsFromRepo);

    const correlations: Array<Runtime.Types.Correlation> =
      await bluebird.map(correlationsFromRepo, (correlation: Runtime.Types.CorrelationFromRepository) => {
        const matchingProcessModelHashes: Array<string> = groupedProcessModelhashes[correlation.id];

        return this._mapCorrelation(correlation, activeFlowNodeInstances, matchingProcessModelHashes);
      });

    return correlations;
  }

  public async getByCorrelationId(correlationId: string): Promise<Runtime.Types.Correlation> {

    // NOTE:
    // These will already be ordered by their createdAt value, with the oldest one at the top.
    const correlationsFromRepo: Array<Runtime.Types.CorrelationFromRepository> = await this.correlationRepository.getByCorrelationId(correlationId);

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this._getActiveFlowNodeInstances();

    const processModelHashes: Array<string> = correlationsFromRepo.map((entry: Runtime.Types.CorrelationFromRepository) => {
      return entry.processModelHash;
    });

    const correlation: Runtime.Types.Correlation =
      await this._mapCorrelation(correlationsFromRepo[0], activeFlowNodeInstances, processModelHashes);

    return correlation;
  }

  public async getByProcessModelId(processModelId: string): Promise<Array<Runtime.Types.Correlation>> {

    const correlationsFromRepo: Array<Runtime.Types.CorrelationFromRepository> =
      await this.correlationRepository.getByProcessModelId(processModelId);

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this._getActiveFlowNodeInstances();

    const correlations: Array<Runtime.Types.Correlation> =
      await bluebird.map(correlationsFromRepo, (correlation: Runtime.Types.CorrelationFromRepository) => {
        return this._mapCorrelation(correlation, activeFlowNodeInstances);
      });

    return correlations;
  }

  public async getByProcessInstanceId(processInstanceId: string): Promise<Runtime.Types.Correlation> {

    const correlationFromRepo: Runtime.Types.CorrelationFromRepository =
      await this.correlationRepository.getByProcessInstanceId(processInstanceId);

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this._getActiveFlowNodeInstances();

    const correlation: Runtime.Types.Correlation =
      await this._mapCorrelation(correlationFromRepo, activeFlowNodeInstances, [correlationFromRepo.processModelHash]);

    return correlation;
  }

  /**
   * Takes a list of CorrelationFromRepository objects and groups the
   * ProcessModelHashes associated with them by their respecitve CorrelationId.
   *
   * @param   correlations The Correlations to group.
   * @returns              The grouped ProcessModelHashes.
   */
  private _groupProcessModelHashes(correlations: Array<Runtime.Types.CorrelationFromRepository>): GroupedProcessModelHashes {

    const groupedHashes: GroupedProcessModelHashes = {};

    for (const correlation of correlations) {

      const groupHasNoMatchingEntry: boolean = !groupedHashes[correlation.id];

      if (groupHasNoMatchingEntry) {
        groupedHashes[correlation.id] = [];
      }

      groupedHashes[correlation.id].push(correlation.processModelHash);
    }

    return groupedHashes;
  }

  /**
   * Maps a given CorrelationFromRepository into a Correlation object,
   * using the given data as a base.
   *
   * @param   correlationFromRepo     The Correlation to map.
   * @param   activeFlowNodeInstances A list of active FlowNodeInstances. This is
   *                                  used to determine the Correlation's state.
   * @param   processModelHashes      A list of hashes associated with the given
   *                                  Correlation. This is used to retrieve all
   *                                  ProcessModels associated with the Correlation.
   * @returns                         The mapped Correlation.
   */
  private async _mapCorrelation(correlationFromRepo: Runtime.Types.CorrelationFromRepository,
                                activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance>,
                                processModelHashes?: Array<string>,
                               ): Promise<Runtime.Types.Correlation> {

    const correlation: Runtime.Types.Correlation = new Runtime.Types.Correlation();
    correlation.id = correlationFromRepo.id;
    correlation.createdAt = correlationFromRepo.createdAt;

    const correlationHasActiveFlowNodeInstances: boolean =
      activeFlowNodeInstances.some((flowNodeInstance: Runtime.Types.FlowNodeInstance): boolean => {
        return flowNodeInstance.correlationId === correlationFromRepo.id;
      });

    correlation.state = correlationHasActiveFlowNodeInstances
      ? Runtime.Types.FlowNodeInstanceState.running
      : Runtime.Types.FlowNodeInstanceState.finished;

    if (processModelHashes) {
      const processDefinitions: Array<Runtime.Types.ProcessDefinitionFromRepository> =
        await bluebird.map(processModelHashes, (hash: string) => {
          return this.processDefinitionRepository.getByHash(hash);
        });

      correlation.processModels = processDefinitions.map((entry: Runtime.Types.ProcessDefinitionFromRepository) => {
        const processModel: Runtime.Types.CorrelationProcessModel = new Runtime.Types.CorrelationProcessModel();
        processModel.name = entry.name;
        processModel.xml = entry.xml;
        processModel.hash = correlationFromRepo.processModelHash;
        processModel.processInstanceId = correlationFromRepo.processInstanceId;
        processModel.createdAt = correlationFromRepo.createdAt;

        return processModel;
      });
    }

    return correlation;
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
