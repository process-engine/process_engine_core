import {
  ICorrelationService,
  IExecutionContextFacade,
  IFlowNodeInstanceRepository,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {IIAMService} from '@essential-projects/iam_contracts';

export class CorrelationService implements ICorrelationService {

  private _flowNodeInstanceRepository: IFlowNodeInstanceRepository;
  private _iamService: IIAMService;

  constructor(flowNodeInstanceRepository: IFlowNodeInstanceRepository,
              iamService: IIAMService) {

    this._flowNodeInstanceRepository = flowNodeInstanceRepository;
    this._iamService = iamService;
  }

  private get flowNodeInstanceRepository(): IFlowNodeInstanceRepository {
    return this._flowNodeInstanceRepository;
  }

  private get iamService(): IIAMService {
    return this._iamService;
  }

  public async getAllActiveCorrelations(executionContextFacade: IExecutionContextFacade): Promise<Array<Runtime.Types.Correlation>> {

    const activeState: Runtime.Types.FlowNodeInstanceState = Runtime.Types.FlowNodeInstanceState.running;

    const activeFlowNodeInstances: Array<Runtime.Types.FlowNodeInstance> = await this.flowNodeInstanceRepository.queryByState(activeState);

    const activeCorrelations: Array<Runtime.Types.Correlation> = await this._getActiveCorrelationsFromFlowNodeList(activeFlowNodeInstances);

    return activeCorrelations;
  }

  private _getActiveCorrelationsFromFlowNodeList(flowNodes: Array<Runtime.Types.FlowNodeInstance>): Array<Runtime.Types.Correlation> {

    const correlations: Array<Runtime.Types.Correlation> = [];

    const correlationsContainsMatchingEntry: Function = (flowNode: Runtime.Types.FlowNodeInstance): boolean => {
      return correlations.some((correlation: Runtime.Types.Correlation) => {
        return correlation.id === flowNode.token.correlationId;
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

  private _createCorrelationFromFlowNodeInstance(flowNode: Runtime.Types.FlowNodeInstance): Runtime.Types.Correlation {

    const correlation: Runtime.Types.Correlation = new Runtime.Types.Correlation();
    correlation.id = flowNode.token.correlationId;
    correlation.processModelId = flowNode.token.processModelId;
    correlation.state = flowNode.state;

    return correlation;
  }

}
