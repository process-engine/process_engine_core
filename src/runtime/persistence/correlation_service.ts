import {
  ICorrelationRepository,
  ICorrelationService,
  IFlowNodeInstanceRepository,
  Runtime,
} from '@process-engine/process_engine_contracts';

export class CorrelationService implements ICorrelationService {

  private _correlationRepository: ICorrelationRepository;
  private _flowNodeInstanceRepository: IFlowNodeInstanceRepository;

  constructor(correlationRepository: ICorrelationRepository,
              flowNodeInstanceRepository: IFlowNodeInstanceRepository) {

    this._correlationRepository = correlationRepository;
    this._flowNodeInstanceRepository = flowNodeInstanceRepository;
  }

  private get correlationRepository(): ICorrelationRepository {
    return this._correlationRepository;
  }

  private get flowNodeInstanceRepository(): IFlowNodeInstanceRepository {
    return this._flowNodeInstanceRepository;
  }

  public async createEntry(correlationId: string, processModelHash: string): Promise<void> {
    return this.correlationRepository.createEntry(correlationId, processModelHash);
  }

  public async getByCorrelationId(correlationId: string): Promise<Runtime.Types.Correlation> {
    return this.correlationRepository.getByCorrelationId(correlationId);
  }

  public async getAllActiveCorrelations(): Promise<Array<Runtime.Types.Correlation>> {

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this._getActiveFlowNodeInstances();

    const activeCorrelations: Array<Runtime.Types.Correlation> = await this._getActiveCorrelationsFromFlowNodeList(activeFlowNodeInstances);

    return activeCorrelations;
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

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> =
      Array.prototype.push.apply(runningFlowNodeInstances, suspendedFlowNodeInstances);

    return activeFlowNodeInstances;
  }

  /**
   * Queries all running and suspended FlowNodeInstances from the repository
   * and returns them as a concatenated result.
   *
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
   * @returns A list of all retrieved FlowNodeInstances.
   */
  private _getActiveCorrelationsFromFlowNodeList(flowNodes: Array<Runtime.Types.FlowNodeInstance>): Array<Runtime.Types.Correlation> {

    const correlations: Array<Runtime.Types.Correlation> = [];

    const correlationsContainsMatchingEntry: Function = (flowNode: Runtime.Types.FlowNodeInstance): boolean => {

      return correlations.some((correlation: Runtime.Types.Correlation) => {

        const hasMatchingToken: boolean = flowNode.tokens.some((token: Runtime.Types.ProcessToken): boolean => {
          return token.correlationId === correlation.id;
        });
        return hasMatchingToken;
      });
    };

    for (const flowNode of flowNodes) {
      if (!correlationsContainsMatchingEntry(flowNode)) {
        const correlation: Runtime.Types.Correlation = this._createCorrelationFromFlowNodeInstance(flowNode);
        correlations.push(correlation);
      }
    }

    return correlations;
  }

  /**
   * Creates a Correlation Object from the given FlowNodeInstance.
   *
   * @returns The created Correlation Object.
   */
  private _createCorrelationFromFlowNodeInstance(flowNode: Runtime.Types.FlowNodeInstance): Runtime.Types.Correlation {

    // Note that correlationid and processModelId will be the same for all of the tokens associated with the FNI.
    // Therefore it doesn't matter which one is being used here.
    const correlation: Runtime.Types.Correlation = new Runtime.Types.Correlation();
    correlation.id = flowNode.tokens[0].correlationId;
    correlation.processModelId = flowNode.tokens[0].processModelId;
    correlation.state = flowNode.state;

    return correlation;
  }

}
