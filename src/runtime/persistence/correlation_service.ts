import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';

import {ForbiddenError, NotFoundError} from '@essential-projects/errors_ts';
import {
  ICorrelationRepository,
  ICorrelationService,
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
  private readonly _iamService: IIAMService;
  private readonly _processDefinitionRepository: IProcessDefinitionRepository;

  constructor(correlationRepository: ICorrelationRepository,
              iamService: IIAMService,
              processDefinitionRepository: IProcessDefinitionRepository) {

    this._correlationRepository = correlationRepository;
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

    const activeCorrelationsFromRepo: Array<Runtime.Types.CorrelationFromRepository>
      = await this._correlationRepository.getCorrelationsByState(Runtime.Types.CorrelationState.running);

    const activeCorrelations: Array<Runtime.Types.Correlation> = await this._mapCorrelationList(activeCorrelationsFromRepo);

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

    const filteredCorrelationsFromRepo: Array<Runtime.Types.CorrelationFromRepository>
      = this._filterCorrelationsFromRepoByIdentity(identity, correlationsFromRepo);

    // All correlations will have the same ID here, so we can just use the top entry as a base.
    const noFilteredCorrelationsFromRepo: boolean = filteredCorrelationsFromRepo.length === 0;
    if (noFilteredCorrelationsFromRepo) {
      throw new NotFoundError('No such correlations for the user.');
    }

    const correlation: Runtime.Types.Correlation =
      await this._mapCorrelation(correlationsFromRepo[0].id, correlationsFromRepo);

    return correlation;
  }

  public async getByProcessInstanceId(identity: IIdentity, processInstanceId: string): Promise<Runtime.Types.Correlation> {
    await this._iamService.ensureHasClaim(identity, canReadProcessModelClaim);

    const correlationFromRepo: Runtime.Types.CorrelationFromRepository =
      await this._correlationRepository.getByProcessInstanceId(processInstanceId);

    const correlation: Runtime.Types.Correlation =
      await this._mapCorrelation(correlationFromRepo.id, [correlationFromRepo]);

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

    const correlation: Runtime.Types.Correlation =
      await this._mapCorrelation(correlationsFromRepo[0].id, correlationsFromRepo);

    return correlation;
  }

  public async deleteCorrelationByProcessModelId(identity: IIdentity, processModelId: string): Promise<void> {
    await this._iamService.ensureHasClaim(identity, canDeleteProcessModel);

    this._correlationRepository.deleteCorrelationByProcessModelId(processModelId);
  }

  public async finishCorrelation(identity: IIdentity, correlationId: string): Promise<void> {
    await this._iamService.ensureHasClaim(identity, canReadProcessModelClaim);
    this._correlationRepository.finishCorrelation(correlationId);
  }

  public async finishWithError(identity: IIdentity, correlationId: string, error: Error): Promise<void> {
    await this._iamService.ensureHasClaim(identity, canReadProcessModelClaim);
    this._correlationRepository.finishWithError(correlationId, error);
  }

  private _filterCorrelationsFromRepoByIdentity(
    identity: IIdentity,
    correlationsFromRepo: Array<Runtime.Types.CorrelationFromRepository>,
  ): Array<Runtime.Types.CorrelationFromRepository> {

    return correlationsFromRepo.filter((correlationFromRepo: Runtime.Types.CorrelationFromRepository) => {
      return identity.userId === correlationFromRepo.identity.userId;
    });
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
    const groupedCorrelations: GroupedCorrelations = this._groupCorrelations(correlationsFromRepo);

    const uniqueCorrelationIds: Array<string> = Object.keys(groupedCorrelations);

    const mappedCorrelations: Array<Runtime.Types.Correlation> =
      await Promise.mapSeries(uniqueCorrelationIds, (correlationId: string) => {
        const matchingCorrelationEntries: Array<Runtime.Types.CorrelationFromRepository> = groupedCorrelations[correlationId];

        return this._mapCorrelation(correlationId, matchingCorrelationEntries);
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
   * @param   correlationEntriess     The list of entries to map.
   * @returns                         The mapped Correlation.
   */
  private async _mapCorrelation(correlationId: string,
                                correlationsFromRepo?: Array<Runtime.Types.CorrelationFromRepository>,
                               ): Promise<Runtime.Types.Correlation> {

    const correlation: Runtime.Types.Correlation = new Runtime.Types.Correlation();
    correlation.id = correlationId;
    correlation.identity = correlationsFromRepo[0].identity;
    correlation.createdAt = correlationsFromRepo[0].createdAt;

    if (correlationsFromRepo) {

      let correlationsContainRunningCorrelation: boolean = false;
      let correlationsContainCorrelationWithError: boolean = false;

      correlation.processModels = await Promise.mapSeries(correlationsFromRepo, async(entry: Runtime.Types.CorrelationFromRepository) => {

        /**
         * If this is already set to true, we don't need to check this again for
         * any of the other Correlation entries.
         */
        correlationsContainRunningCorrelation =
          !correlationsContainRunningCorrelation
          && entry.state === Runtime.Types.CorrelationState.running;

        const correlationEntryHasErrorAttached: boolean =
          entry.error !== null
          && entry.error !== undefined;

        if (correlationEntryHasErrorAttached) {
          correlationsContainCorrelationWithError = true;
          correlation.error = entry.error;
        }

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
        processModel.state = entry.state;

        if (correlationEntryHasErrorAttached) {
          processModel.error = entry.error;
        }

        return processModel;
      });

    /**
     * If a correlation entry with the given CorrelationID has a running
     * state, we want the whole Correlation to be marked as running.
     *
     * If not, we check if the Correlation Entries contains a Correlation with
     * an error state. If also not, we set the state to finished.
     */
      if (correlationsContainRunningCorrelation) {
        correlation.state = Runtime.Types.CorrelationState.running;
      } else {
        correlation.state = correlationsContainCorrelationWithError
                              ? Runtime.Types.CorrelationState.error
                              : Runtime.Types.CorrelationState.finished;
      }
    }

    return correlation;
  }
}
