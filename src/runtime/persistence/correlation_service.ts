import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';

import {ForbiddenError, NotFoundError} from '@essential-projects/errors_ts';
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
type GroupedCorrelations = {
  [correlationId: string]: Array<Runtime.Types.CorrelationFromRepository>,
};

const canReadProcessModelClaim: string = 'can_read_process_model';
const canDeleteProcessModel: string = 'can_delete_process_model';

export class CorrelationService implements ICorrelationService {

  private readonly _correlationRepository: ICorrelationRepository;
  private readonly _flowNodeInstanceRepository: IFlowNodeInstanceRepository;
  private readonly _iamService: IIAMService;
  private readonly _processDefinitionRepository: IProcessDefinitionRepository;

  constructor(correlationRepository: ICorrelationRepository,
              flowNodeInstanceRepository: IFlowNodeInstanceRepository,
              iamService: IIAMService,
              processDefinitionRepository: IProcessDefinitionRepository) {

    this._correlationRepository = correlationRepository;
    this._flowNodeInstanceRepository = flowNodeInstanceRepository;
    this._iamService = iamService;
    this._processDefinitionRepository = processDefinitionRepository;
  }

  public async createEntry(identity: IIdentity,
                           correlationId: string,
                           processInstanceId: string,
                           processModelId: string,
                           processModelHash: string,
                           parentProcessInstanceId?: string): Promise<void> {
    return this
      ._correlationRepository
      .createEntry(identity, correlationId, processInstanceId, processModelId, processModelHash, parentProcessInstanceId);
  }

  public async getActive(identity: IIdentity): Promise<Array<Runtime.Types.Correlation>> {
    await this._iamService.ensureHasClaim(identity, canReadProcessModelClaim);

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this._getActiveFlowNodeInstances();

    const filteredActiveFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      this._filterActiveFlowNodeInstancesByIdentity(identity, activeFlowNodeInstances);

    const activeCorrelations: Array<Runtime.Types.Correlation> = await this._getActiveCorrelationsFromFlowNodeList(filteredActiveFlowNodeInstances);

    return activeCorrelations;
  }

  public async getAll(identity: IIdentity): Promise<Array<Runtime.Types.Correlation>> {
    await this._iamService.ensureHasClaim(identity, canReadProcessModelClaim);

    const correlationsFromRepo: Array<Runtime.Types.CorrelationFromRepository> = await this._correlationRepository.getAll();

    const filteredCorrelationsFromRepo: Array<Runtime.Types.CorrelationFromRepository> =
      this._filterCorrelationsFromRepoByIdentity(identity, correlationsFromRepo);

    const correlations: Array<Runtime.Types.Correlation> = await this._mapCorrelationList(filteredCorrelationsFromRepo);

    return correlations;
  }

  public async getByProcessModelId(identity: IIdentity, processModelId: string): Promise<Array<Runtime.Types.Correlation>> {
    await this._iamService.ensureHasClaim(identity, canReadProcessModelClaim);

    const correlationsFromRepo: Array<Runtime.Types.CorrelationFromRepository> =
      await this._correlationRepository.getByProcessModelId(processModelId);

    const filteredCorrelationsFromRepo: Array<Runtime.Types.CorrelationFromRepository> =
      this._filterCorrelationsFromRepoByIdentity(identity, correlationsFromRepo);

    const correlations: Array<Runtime.Types.Correlation> = await this._mapCorrelationList(filteredCorrelationsFromRepo);

    return correlations;
  }

  public async getByCorrelationId(identity: IIdentity, correlationId: string): Promise<Runtime.Types.Correlation> {
    await this._iamService.ensureHasClaim(identity, canReadProcessModelClaim);

    // NOTE:
    // These will already be ordered by their createdAt value, with the oldest one at the top.
    const correlationsFromRepo: Array<Runtime.Types.CorrelationFromRepository> =
      await this._correlationRepository.getByCorrelationId(correlationId);

    const filteredCorrelationsFromRepo: Array<Runtime.Types.CorrelationFromRepository> =
      this._filterCorrelationsFromRepoByIdentity(identity, correlationsFromRepo);

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this._getActiveFlowNodeInstances();

    // All correlations will have the same ID here, so we can just use the top entry as a base.
    const noFilteredCorrelationsFromRepo: boolean = filteredCorrelationsFromRepo.length === 0;
    if (noFilteredCorrelationsFromRepo) {
      throw new NotFoundError('No such correlations for the user.');
    }

    const correlation: Runtime.Types.Correlation =
      await this._mapCorrelation(filteredCorrelationsFromRepo[0].id, activeFlowNodeInstances, filteredCorrelationsFromRepo);

    return correlation;
  }

  public async getByProcessInstanceId(identity: IIdentity, processInstanceId: string): Promise<Runtime.Types.Correlation> {
    await this._iamService.ensureHasClaim(identity, canReadProcessModelClaim);

    const correlationFromRepo: Runtime.Types.CorrelationFromRepository =
      await this._correlationRepository.getByProcessInstanceId(processInstanceId);

    const correlationBelongsToDifferentUser: boolean = identity.userId !== correlationFromRepo.identity.userId;

    if (correlationBelongsToDifferentUser) {
      throw new ForbiddenError('Access denied.');
    }

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this._getActiveFlowNodeInstances();

    const correlation: Runtime.Types.Correlation =
      await this._mapCorrelation(correlationFromRepo.id, activeFlowNodeInstances, [correlationFromRepo]);

    return correlation;
  }

  public async getSubprocessesForProcessInstance(identity: IIdentity, processInstanceId: string): Promise<Runtime.Types.Correlation> {
    await this._iamService.ensureHasClaim(identity, canReadProcessModelClaim);

    const correlationsFromRepo: Array<Runtime.Types.CorrelationFromRepository> =
      await this._correlationRepository.getSubprocessesForProcessInstance(processInstanceId);

    const filteredCorrelationsFromRepo: Array<Runtime.Types.CorrelationFromRepository> =
      this._filterCorrelationsFromRepoByIdentity(identity, correlationsFromRepo);

    const noFilteredCorrelations: boolean = filteredCorrelationsFromRepo.length === 0;
    if (noFilteredCorrelations) {
      return undefined;
    }

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this._getActiveFlowNodeInstances();

    const correlation: Runtime.Types.Correlation =
      await this._mapCorrelation(correlationsFromRepo[0].id, activeFlowNodeInstances, correlationsFromRepo);

    return correlation;
  }

  public async deleteCorrelationByProcessModelId(identity: IIdentity, processModelId: string): Promise<void> {
    await this._iamService.ensureHasClaim(identity, canDeleteProcessModel);

    this._correlationRepository.deleteCorrelationByProcessModelId(processModelId);
  }

  public async finishCorrelation(correlationId: string): Promise<void> {
    this._correlationRepository.finishCorrelation(correlationId);
  }

  public async finishWithError(correlationId: string, error?: Error): Promise<void> {
    this._correlationRepository.finishWithError(correlationId, error);
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

    const groupedCorrelations: GroupedCorrelations = this._groupCorrelations(correlationsFromRepo);

    const uniqueCorrelationIds: Array<string> = Object.keys(groupedCorrelations);

    const mappedCorrelations: Array<Runtime.Types.Correlation> =
      await Promise.mapSeries(uniqueCorrelationIds, (correlationId: string) => {
        const matchingCorrelationEntries: Array<Runtime.Types.CorrelationFromRepository> = groupedCorrelations[correlationId];

        return this._mapCorrelation(correlationId, activeFlowNodeInstances, matchingCorrelationEntries);
      });

    return mappedCorrelations;
  }

  /**
   * Takes a list of CorrelationFromRepository objects and groups them by their
   * CorrelationId.
   *
   * @param   correlations The Correlations to group.
   * @returns              The grouped Correlations.
   */
  private _groupCorrelations(correlations: Array<Runtime.Types.CorrelationFromRepository>): GroupedCorrelations {

    const groupedCorrelations: GroupedCorrelations = {};

    for (const correlation of correlations) {

      const groupHasNoMatchingEntry: boolean = !groupedCorrelations[correlation.id];

      if (groupHasNoMatchingEntry) {
        groupedCorrelations[correlation.id] = [];
      }

      groupedCorrelations[correlation.id].push(correlation);
    }

    return groupedCorrelations;
  }

  /**
   * Maps a given list of CorrelationFromRepository objects into a,
   * Correlation object, using the given CorrelationId as a base.
   *
   * @async
   * @param   correlationId           The ID of the Correlation to map.
   * @param   activeFlowNodeInstances A list of active FlowNodeInstances. This is
   *                                  used to determine the Correlation's state.
   * @param   correlationEntriess     The list of entries to map.
   * @returns                         The mapped Correlation.
   */
  private async _mapCorrelation(correlationId: string,
                                activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance>,
                                correlationsFromRepo?: Array<Runtime.Types.CorrelationFromRepository>,
                               ): Promise<Runtime.Types.Correlation> {

    const correlation: Runtime.Types.Correlation = new Runtime.Types.Correlation();
    correlation.id = correlationId;
    correlation.identity = correlationsFromRepo[0].identity;
    correlation.createdAt = correlationsFromRepo[0].createdAt;

    const correlationHasActiveProcessInstances: boolean =
      activeFlowNodeInstances.some((flowNodeInstance: Runtime.Types.FlowNodeInstance): boolean => {
        return flowNodeInstance.correlationId === correlationId;
      });

    correlation.state = correlationHasActiveProcessInstances
      ? Runtime.Types.FlowNodeInstanceState.running
      : Runtime.Types.FlowNodeInstanceState.finished;

    if (correlationsFromRepo) {

      correlation.processModels = await Promise.mapSeries(correlationsFromRepo, async(entry: Runtime.Types.CorrelationFromRepository) => {

        const processDefinition: Runtime.Types.ProcessDefinitionFromRepository =
          await this._processDefinitionRepository.getByHash(entry.processModelHash);

        const processModel: Runtime.Types.CorrelationProcessInstance = new Runtime.Types.CorrelationProcessInstance();
        processModel.processDefinitionName = processDefinition.name;
        processModel.xml = processDefinition.xml;
        processModel.hash = entry.processModelHash;
        processModel.processModelId = entry.processModelId;
        processModel.processInstanceId = entry.processInstanceId;
        processModel.parentProcessInstanceId = entry.parentProcessInstanceId;
        processModel.createdAt = entry.createdAt;

        const processHasActiveFlowNodeInstances: boolean =
          activeFlowNodeInstances.some((flowNodeInstance: Runtime.Types.FlowNodeInstance): boolean => {
            return flowNodeInstance.processInstanceId === entry.processInstanceId;
          });

        processModel.state = processHasActiveFlowNodeInstances
          ? Runtime.Types.FlowNodeInstanceState.running
          : Runtime.Types.FlowNodeInstanceState.finished;

        return processModel;
      });
    }

    return correlation;
  }

  /**
   * Queries all "running" and "suspended" FlowNodeInstances from the repository.
   *
   * @async
   * @returns All retrieved active FlowNodeInstances.
   */
  private async _getActiveFlowNodeInstances(): Promise<Array<Runtime.Types.FlowNodeInstance>> {

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      await this._flowNodeInstanceRepository.queryActive();

    return activeFlowNodeInstances;
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
   * Retrieves all entries from the correlation repository that have the
   * matching correlation ID.
   * Afterwards, the associated ProcessModelHashes are used to retrieve the
   * corresponding ProcessModels.
   *
   * @async
   * @param   correlationId The correlationId for which to get the ProcessModels.
   * @returns               The retrieved ProcessModels.
   */
  private async _getProcessDefinitionsForCorrelation(correlationId: string): Promise<Array<Runtime.Types.CorrelationProcessInstance>> {

    const correlations: Array<Runtime.Types.CorrelationFromRepository> = await this._correlationRepository.getByCorrelationId(correlationId);

    const processDefinitions: Array<Runtime.Types.CorrelationProcessInstance> =
      await Promise.mapSeries(correlations, async(correlation: Runtime.Types.CorrelationFromRepository) => {

        const processDefinition: Runtime.Types.ProcessDefinitionFromRepository =
          await this._processDefinitionRepository.getByHash(correlation.processModelHash);

        const processModel: Runtime.Types.CorrelationProcessInstance = new Runtime.Types.CorrelationProcessInstance();
        processModel.processDefinitionName = processDefinition.name;
        processModel.hash = processDefinition.hash;
        processModel.xml = processDefinition.xml;
        processModel.createdAt = processDefinition.createdAt;
        processModel.processModelId = correlation.processModelId;
        processModel.processInstanceId = correlation.processInstanceId;
        processModel.parentProcessInstanceId = correlation.parentProcessInstanceId;
        // For this UseCase, we can safely assume the running-state,
        // because we already made sure that only active correlations have been retrieved.
        processModel.state = Runtime.Types.FlowNodeInstanceState.running;

        return processModel;
      });

    return processDefinitions;
  }
}
