import {
  IExecutionContextFacade,
  IFlowNodeInstancePersistenceRepository,
  IFlowNodeInstancePersistenceService,
  IIamFacadeFactory,
  Runtime,
} from '@process-engine/process_engine_contracts';

export class FlowNodeInstancePersistenceService implements IFlowNodeInstancePersistenceService {

  private _flowNodeInstancePersistenceRepository: IFlowNodeInstancePersistenceRepository;
  private _iamFacadeFactory: IIamFacadeFactory;

  constructor(flowNodeInstancePersistenceRepository: IFlowNodeInstancePersistenceRepository, iamFacadeFactory: IIamFacadeFactory) {
    this._flowNodeInstancePersistenceRepository = flowNodeInstancePersistenceRepository;
    this._iamFacadeFactory = iamFacadeFactory;
  }

  private get flowNodeInstancePersistenceRepository(): IFlowNodeInstancePersistenceRepository {
    return this._flowNodeInstancePersistenceRepository;
  }

  private get iamFacadeFactory(): IIamFacadeFactory {
    return this._iamFacadeFactory;
  }

  public async queryByCorrelation(executionContextFacade: IExecutionContextFacade,
                                  correlationId: string,
                                 ): Promise<Array<Runtime.Types.FlowNodeInstance>> {

    return this.flowNodeInstancePersistenceRepository.queryByCorrelation(correlationId);
  }

  public async queryByProcessModel(executionContextFacade: IExecutionContextFacade,
                                   processModelId: string,
                                  ): Promise<Array<Runtime.Types.FlowNodeInstance>> {

    return this.flowNodeInstancePersistenceRepository.queryByProcessModel(processModelId);
  }

  public async querySuspendedByCorrelation(executionContextFacade: IExecutionContextFacade,
                                           correlationId: string,
                                          ): Promise<Array<Runtime.Types.FlowNodeInstance>> {

    return this.flowNodeInstancePersistenceRepository.querySuspendedByCorrelation(correlationId);
  }

  public async querySuspendedByProcessModel(executionContextFacade: IExecutionContextFacade,
                                            processModelId: string,
                                           ): Promise<Array<Runtime.Types.FlowNodeInstance>> {

    return this.flowNodeInstancePersistenceRepository.querySuspendedByProcessModel(processModelId);
  }

  public async persistOnEnter(executionContextFacade: IExecutionContextFacade,
                              token: Runtime.Types.ProcessToken,
                              flowNodeId: string,
                              flowNodeInstanceId: string,
                            ): Promise<Runtime.Types.FlowNodeInstance> {

    return this.flowNodeInstancePersistenceRepository.persistOnEnter(token, flowNodeId, flowNodeInstanceId);
  }

  public async persistOnExit(executionContextFacade: IExecutionContextFacade,
                             token: Runtime.Types.ProcessToken,
                             flowNodeId: string,
                             flowNodeInstanceId: string,
                            ): Promise<Runtime.Types.FlowNodeInstance> {

    return this.flowNodeInstancePersistenceRepository.persistOnExit(token, flowNodeId, flowNodeInstanceId);
  }

  public async suspend(executionContextFacade: IExecutionContextFacade,
                       token: Runtime.Types.ProcessToken,
                       flowNodeInstanceId: string,
                       correlationHash?: string,
                      ): Promise<Runtime.Types.FlowNodeInstance> {

    return this.flowNodeInstancePersistenceRepository.suspend(token, flowNodeInstanceId, correlationHash);
  }

  public async resume(executionContextFacade: IExecutionContextFacade, flowNodeInstanceId: string): Promise<Runtime.Types.FlowNodeInstance> {
    return this.flowNodeInstancePersistenceRepository.resume(flowNodeInstanceId);
  }

}