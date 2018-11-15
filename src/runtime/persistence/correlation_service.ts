import * as bluebird from 'bluebird';

import {IIdentity} from '@essential-projects/iam_contracts';

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

  private readonly _correlationRepository: ICorrelationRepository;
  private readonly _flowNodeInstanceRepository: IFlowNodeInstanceRepository;
  private readonly _processDefinitionRepository: IProcessDefinitionRepository;

  constructor(correlationRepository: ICorrelationRepository,
              flowNodeInstanceRepository: IFlowNodeInstanceRepository,
              processDefinitionRepository: IProcessDefinitionRepository) {

    this._correlationRepository = correlationRepository;
    this._flowNodeInstanceRepository = flowNodeInstanceRepository;
    this._processDefinitionRepository = processDefinitionRepository;
  }

  public async createEntry(identity: IIdentity,
                           correlationId: string,
                           processInstanceId: string,
                           processModelId: string,
                           processModelHash: string): Promise<void> {
    return this._correlationRepository.createEntry(identity, correlationId, processInstanceId, processModelId, processModelHash);
  }

  public async getActive(): Promise<Array<Runtime.Types.Correlation>> {

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this._getActiveFlowNodeInstances();

    const activeCorrelations: Array<Runtime.Types.Correlation> = await this._getActiveCorrelationsFromFlowNodeList(activeFlowNodeInstances);

    return activeCorrelations;
  }

  public async getAll(): Promise<Array<Runtime.Types.Correlation>> {

    const correlationsFromRepo: Array<Runtime.Types.CorrelationFromRepository> = await this._correlationRepository.getAll();

    const correlations: Array<Runtime.Types.Correlation> = await this._mapCorrelationList(correlationsFromRepo);

    return correlations;
  }

  public async getByProcessModelId(processModelId: string): Promise<Array<Runtime.Types.Correlation>> {

    const correlationsFromRepo: Array<Runtime.Types.CorrelationFromRepository> =
      await this._correlationRepository.getByProcessModelId(processModelId);

    const correlations: Array<Runtime.Types.Correlation> = await this._mapCorrelationList(correlationsFromRepo);

    return correlations;
  }

  public async getByCorrelationId(correlationId: string): Promise<Runtime.Types.Correlation> {

    // NOTE:
    // These will already be ordered by their createdAt value, with the oldest one at the top.
    const correlationsFromRepo: Array<Runtime.Types.CorrelationFromRepository> =
      await this._correlationRepository.getByCorrelationId(correlationId);

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this._getActiveFlowNodeInstances();

    const processModelHashes: Array<string> = correlationsFromRepo.map((entry: Runtime.Types.CorrelationFromRepository) => {
      return entry.processModelHash;
    });

    // All correlations will have the same ID here, so we can just use the top entry as a base.
    const correlation: Runtime.Types.Correlation =
      await this._mapCorrelation(correlationsFromRepo[0], activeFlowNodeInstances, processModelHashes);

    return correlation;
  }

  public async getByProcessInstanceId(processInstanceId: string): Promise<Runtime.Types.Correlation> {

    const correlationFromRepo: Runtime.Types.CorrelationFromRepository =
      await this._correlationRepository.getByProcessInstanceId(processInstanceId);

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this._getActiveFlowNodeInstances();

    const correlation: Runtime.Types.Correlation =
      await this._mapCorrelation(correlationFromRepo, activeFlowNodeInstances, [correlationFromRepo.processModelHash]);

    return correlation;
  }

  public async deleteCorrelationByProcessModelId(processModelId: string): Promise<void> {
    this._correlationRepository.deleteCorrelationByProcessModelId(processModelId);
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
   * Maps a given List of CorrelationFromRepository objects into a List of
   * Runtime Correlation objects.
   *
   * @async
   * @param   correlationsFromRepo The Correlations to map.
   * @returns                      The mapped Correlation.
   */
  private async _mapCorrelationList(correlationsFromRepo: Array<Runtime.Types.CorrelationFromRepository>): Promise<Array<Runtime.Types.Correlation>> {

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this._getActiveFlowNodeInstances();

    const groupedProcessModelhashes: GroupedProcessModelHashes = this._groupProcessModelHashes(correlationsFromRepo);

    const mappedCorrelations: Array<Runtime.Types.Correlation> =
      await bluebird.map(correlationsFromRepo, (correlation: Runtime.Types.CorrelationFromRepository) => {
        const matchingProcessModelHashes: Array<string> = groupedProcessModelhashes[correlation.id];

        return this._mapCorrelation(correlation, activeFlowNodeInstances, matchingProcessModelHashes);
      });

    return mappedCorrelations;
  }

  /**
   * Maps a given CorrelationFromRepository into a Correlation object,
   * using the given data as a base.
   *
   * @async
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
    correlation.identity = correlationFromRepo.identity;
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
          return this._processDefinitionRepository.getByHash(hash);
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
   *
   * @async
   * @returns All retrieved FlowNodeInstances.
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
      await this._flowNodeInstanceRepository.queryByState(runningState);

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
      await this._flowNodeInstanceRepository.queryByState(suspendedState);

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
        const correlation: Runtime.Types.Correlation = await this._createCorrelationFromActiveFlowNodeInstance(flowNode);
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
  private async _createCorrelationFromActiveFlowNodeInstance(flowNodeInstance: Runtime.Types.FlowNodeInstance): Promise<Runtime.Types.Correlation> {

    // Note that correlationid and processModelId will be the same for all of the tokens associated with the FNI.
    // Therefore it doesn't matter which one is being used here.
    const correlation: Runtime.Types.Correlation = new Runtime.Types.Correlation();
    correlation.id = flowNodeInstance.tokens[0].correlationId;
    correlation.state = Runtime.Types.FlowNodeInstanceState.running;
    correlation.identity = flowNodeInstance.tokens[0].identity;
    correlation.createdAt = flowNodeInstance.tokens[0].createdAt;
    correlation.processModels = await this._getProcessDefinitionsForCorrelation(flowNodeInstance.correlationId);

    return correlation;
  }

  /**
   * Retrieves all entries from the correlation repository that have th
   *  matching correlation ID.
   * Afterwards, the associated ProcessModelHashes are used to retrieve the
   * corresponding ProcessModels.
   *
   * @async
   * @param   correlationId     The correlationId for which to get the ProcessModels.
   * @returns                   The retrieved ProcessModels.
   */
  private async _getProcessDefinitionsForCorrelation(correlationId: string): Promise<Array<Runtime.Types.CorrelationProcessModel>> {

    const correlations: Array<Runtime.Types.CorrelationFromRepository> = await this._correlationRepository.getByCorrelationId(correlationId);

    const processDefinitions: Array<Runtime.Types.CorrelationProcessModel> =
      await bluebird.map(correlations, async(correlation: Runtime.Types.CorrelationFromRepository) => {

        const processDefinition: Runtime.Types.ProcessDefinitionFromRepository =
          await this._processDefinitionRepository.getByHash(correlation.processModelHash);

        const processModel: Runtime.Types.CorrelationProcessModel = new Runtime.Types.CorrelationProcessModel();
        processModel.name = processDefinition.name;
        processModel.hash = processDefinition.hash;
        processModel.xml = processDefinition.xml;
        processModel.createdAt = processDefinition.createdAt;
        processModel.processInstanceId = correlation.processInstanceId;

        return processModel;
      });

    return processDefinitions;
  }
}
