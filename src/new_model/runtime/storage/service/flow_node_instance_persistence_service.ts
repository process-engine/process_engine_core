import {IFlowNodeInstancePersistence, IIamFacadeFactory, Runtime} from '@process-engine/process_engine_contracts';

export class FlowNodeInstancePersistenceService implements IFlowNodeInstancePersistence {

  private _flowNodeInstancePersistenceRepository: IFlowNodeInstancePersistence;
  private _iamFacadeFactory: IIamFacadeFactory;

  constructor(flowNodeInstancePersistenceRepository: IFlowNodeInstancePersistence, iamFacadeFactory: IIamFacadeFactory) {
    this._flowNodeInstancePersistenceRepository = flowNodeInstancePersistenceRepository;
    this._iamFacadeFactory = iamFacadeFactory;
  }

  private get flowNodeInstancePersistenceRepository(): IFlowNodeInstancePersistence {
    return this._flowNodeInstancePersistenceRepository;
  }

  private get iamFacadeFactory(): IIamFacadeFactory {
    return this._iamFacadeFactory;
  }

  public async queryByCorrelation(correlationId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {
    return this.flowNodeInstancePersistenceRepository.queryByCorrelation(correlationId);
  }

  public async queryByProcessModel(processModelId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {
    return this.flowNodeInstancePersistenceRepository.queryByProcessModel(processModelId);
  }

  public async querySuspendedByCorrelation(correlationId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {
    return this.flowNodeInstancePersistenceRepository.querySuspendedByCorrelation(correlationId);
  }

  public async querySuspendedByProcessModel(processModelId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {
    return this.flowNodeInstancePersistenceRepository.querySuspendedByProcessModel(processModelId);
  }

  public async persistOnEnter(token: Runtime.Types.ProcessToken,
                              flowNodeId: string,
                              flowNodeInstanceId: string,
                            ): Promise<Runtime.Types.FlowNodeInstance> {
    return this.flowNodeInstancePersistenceRepository.persistOnEnter(token, flowNodeId, flowNodeInstanceId);
  }

  public async persistOnExit(token: Runtime.Types.ProcessToken,
                             flowNodeId: string,
                             flowNodeInstanceId: string,
                            ): Promise<Runtime.Types.FlowNodeInstance> {
    return this.flowNodeInstancePersistenceRepository.persistOnExit(token, flowNodeId, flowNodeInstanceId);
  }

  public async suspend(token: Runtime.Types.ProcessToken,
                       flowNodeInstanceId: string,
                       correlationHash?: string,
                      ): Promise<Runtime.Types.FlowNodeInstance> {
    return this.flowNodeInstancePersistenceRepository.suspend(token, flowNodeInstanceId, correlationHash);
  }

  public async resume(flowNodeInstanceId: string): Promise<Runtime.Types.FlowNodeInstance> {
    return this.flowNodeInstancePersistenceRepository.resume(flowNodeInstanceId);
  }

}
