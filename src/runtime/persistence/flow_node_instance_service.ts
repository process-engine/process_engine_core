import {
  IFlowNodeInstanceRepository,
  IFlowNodeInstanceService,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {IIAMService} from '@essential-projects/iam_contracts';

export class FlowNodeInstanceService implements IFlowNodeInstanceService {

  private readonly _flowNodeInstanceRepository: IFlowNodeInstanceRepository;
  private readonly _iamService: IIAMService;

  constructor(flowNodeInstanceRepository: IFlowNodeInstanceRepository,
              iamService: IIAMService) {

    this._flowNodeInstanceRepository = flowNodeInstanceRepository;
    this._iamService = iamService;
  }

  public async querySpecificFlowNode(correlationId: string, processModelId: string, flowNodeId: string): Promise<Runtime.Types.FlowNodeInstance> {
    return this._flowNodeInstanceRepository.querySpecificFlowNode(correlationId, processModelId, flowNodeId);
  }

  public async queryByFlowNodeId(flowNodeId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {
    return this._flowNodeInstanceRepository.queryByFlowNodeId(flowNodeId);
  }

  public async queryByInstanceId(instanceId: string): Promise<Runtime.Types.FlowNodeInstance> {
    return this._flowNodeInstanceRepository.queryByInstanceId(instanceId);
  }

  public async queryByCorrelation(correlationId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {
    return this._flowNodeInstanceRepository.queryByCorrelation(correlationId);
  }

  public async queryByProcessModel(processModelId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {
    return this._flowNodeInstanceRepository.queryByProcessModel(processModelId);
  }

  public async querySuspendedByCorrelation(correlationId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {
    return this._flowNodeInstanceRepository.querySuspendedByCorrelation(correlationId);
  }

  public async querySuspendedByProcessModel(processModelId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {
    return this._flowNodeInstanceRepository.querySuspendedByProcessModel(processModelId);
  }
  public async queryProcessTokensByProcessInstanceId(processInstanceId: string): Promise<Array<Runtime.Types.ProcessToken>> {
    return this._flowNodeInstanceRepository.queryProcessTokensByProcessInstanceId(processInstanceId);
  }

  public async persistOnEnter(flowNode: Model.Base.FlowNode,
                              flowNodeInstanceId: string,
                              token: Runtime.Types.ProcessToken,
                             ): Promise<Runtime.Types.FlowNodeInstance> {

    return this._flowNodeInstanceRepository.persistOnEnter(flowNode, flowNodeInstanceId, token);
  }

  public async persistOnExit(flowNode: Model.Base.FlowNode,
                             flowNodeInstanceId: string,
                             token: Runtime.Types.ProcessToken,
                            ): Promise<Runtime.Types.FlowNodeInstance> {

    return this._flowNodeInstanceRepository.persistOnExit(flowNode, flowNodeInstanceId, token);
  }

  public async persistOnError(flowNode: Model.Base.FlowNode,
                              flowNodeInstanceId: string,
                              token: Runtime.Types.ProcessToken,
                              error: Error,
                             ): Promise<Runtime.Types.FlowNodeInstance> {

    return this._flowNodeInstanceRepository.persistOnError(flowNode, flowNodeInstanceId, token, error);
  }

  public async persistOnTerminate(flowNode: Model.Base.FlowNode,
                                  flowNodeInstanceId: string,
                                  token: Runtime.Types.ProcessToken,
                                 ): Promise<Runtime.Types.FlowNodeInstance> {

    return this._flowNodeInstanceRepository.persistOnTerminate(flowNode, flowNodeInstanceId, token);
  }

  public async suspend(flowNodeId: string, flowNodeInstanceId: string, token: Runtime.Types.ProcessToken): Promise<Runtime.Types.FlowNodeInstance> {
    return this._flowNodeInstanceRepository.suspend(flowNodeId, flowNodeInstanceId, token);
  }

  public async resume(flowNodeId: string, flowNodeInstanceId: string, token: Runtime.Types.ProcessToken): Promise<Runtime.Types.FlowNodeInstance> {
    return this._flowNodeInstanceRepository.resume(flowNodeId, flowNodeInstanceId, token);
  }

  public async deleteByProcessModelId(processModelId: string): Promise<void> {
    return this._flowNodeInstanceRepository.deleteByProcessModelId(processModelId);
  }

}
