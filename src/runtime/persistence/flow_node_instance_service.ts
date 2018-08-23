import {
  IFlowNodeInstanceRepository,
  IFlowNodeInstanceService,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {IIAMService} from '@essential-projects/iam_contracts';

export class FlowNodeInstanceService implements IFlowNodeInstanceService {

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

  public async queryByInstanceId(instanceId: string): Promise<Runtime.Types.FlowNodeInstance> {

    return this.flowNodeInstanceRepository.queryByInstanceId(instanceId);
  }

  public async queryByCorrelation(correlationId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {

    return this.flowNodeInstanceRepository.queryByCorrelation(correlationId);
  }

  public async queryByProcessModel(processModelId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {

    return this.flowNodeInstanceRepository.queryByProcessModel(processModelId);
  }

  public async querySuspendedByCorrelation(correlationId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {

    return this.flowNodeInstanceRepository.querySuspendedByCorrelation(correlationId);
  }

  public async querySuspendedByProcessModel(processModelId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {

    return this.flowNodeInstanceRepository.querySuspendedByProcessModel(processModelId);
  }
  public async queryProcessTokensByProcessInstanceId(processInstanceId: string): Promise<Array<Runtime.Types.ProcessToken>> {

    return this.flowNodeInstanceRepository.queryProcessTokensByProcessInstanceId(processInstanceId);
  }

  public async persistOnEnter(flowNodeId: string,
                              flowNodeInstanceId: string,
                              token: Runtime.Types.ProcessToken,
                             ): Promise<Runtime.Types.FlowNodeInstance> {

    return this.flowNodeInstanceRepository.persistOnEnter(flowNodeId, flowNodeInstanceId, token);
  }

  public async persistOnExit(flowNodeId: string,
                             flowNodeInstanceId: string,
                             token: Runtime.Types.ProcessToken,
                            ): Promise<Runtime.Types.FlowNodeInstance> {

    return this.flowNodeInstanceRepository.persistOnExit(flowNodeId, flowNodeInstanceId, token);
  }

  public async persistOnError(flowNodeId: string,
                              flowNodeInstanceId: string,
                              token: Runtime.Types.ProcessToken,
                              error: Error,
                             ): Promise<Runtime.Types.FlowNodeInstance> {

    return this.flowNodeInstanceRepository.persistOnError(flowNodeId, flowNodeInstanceId, token, error);
  }

  public async persistOnTerminate(flowNodeId: string,
                                  flowNodeInstanceId: string,
                                  token: Runtime.Types.ProcessToken,
                                 ): Promise<Runtime.Types.FlowNodeInstance> {

    return this.flowNodeInstanceRepository.persistOnTerminate(flowNodeId, flowNodeInstanceId, token);
  }

  public async suspend(flowNodeId: string, flowNodeInstanceId: string, token: Runtime.Types.ProcessToken): Promise<Runtime.Types.FlowNodeInstance> {

    return this.flowNodeInstanceRepository.suspend(flowNodeId, flowNodeInstanceId, token);
  }

  public async resume(flowNodeId: string, flowNodeInstanceId: string, token: Runtime.Types.ProcessToken): Promise<Runtime.Types.FlowNodeInstance> {
    return this.flowNodeInstanceRepository.resume(flowNodeId, flowNodeInstanceId, token);
  }

}
