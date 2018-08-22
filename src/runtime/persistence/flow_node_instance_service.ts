import {
  IExecutionContextFacade,
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

  public async getFlowNodeInstanceById(flowNodeInstanceId: string): Promise<Runtime.Types.FlowNodeInstance> {
    return this.flowNodeInstanceRepository.getFlowNodeInstanceById(flowNodeInstanceId);
  }

  public async queryByCorrelation(executionContextFacade: IExecutionContextFacade,
                                  correlationId: string,
                                 ): Promise<Array<Runtime.Types.FlowNodeInstance>> {

    return this.flowNodeInstanceRepository.queryByCorrelation(correlationId);
  }

  public async queryByProcessModel(executionContextFacade: IExecutionContextFacade,
                                   processModelId: string,
                                  ): Promise<Array<Runtime.Types.FlowNodeInstance>> {

    return this.flowNodeInstanceRepository.queryByProcessModel(processModelId);
  }

  public async queryProcessTokensByProcessInstance(processInstanceId: string): Promise<Array<Runtime.Types.ProcessToken>> {
    return this.flowNodeInstanceRepository.queryProcessTokensByProcessInstance(processInstanceId);
  }

  public async querySuspendedByCorrelation(executionContextFacade: IExecutionContextFacade,
                                           correlationId: string,
                                          ): Promise<Array<Runtime.Types.FlowNodeInstance>> {

    return this.flowNodeInstanceRepository.querySuspendedByCorrelation(correlationId);
  }

  public async querySuspendedByProcessModel(executionContextFacade: IExecutionContextFacade,
                                            processModelId: string,
                                           ): Promise<Array<Runtime.Types.FlowNodeInstance>> {

    return this.flowNodeInstanceRepository.querySuspendedByProcessModel(processModelId);
  }

  public async persistOnEnter(executionContextFacade: IExecutionContextFacade,
                              token: Runtime.Types.ProcessToken,
                              flowNodeId: string,
                              flowNodeInstanceId: string,
                             ): Promise<Runtime.Types.FlowNodeInstance> {

    return this.flowNodeInstanceRepository.persistOnEnter(token, flowNodeId, flowNodeInstanceId);
  }

  public async persistOnExit(executionContextFacade: IExecutionContextFacade,
                             token: Runtime.Types.ProcessToken,
                             flowNodeId: string,
                             flowNodeInstanceId: string,
                            ): Promise<Runtime.Types.FlowNodeInstance> {

    return this.flowNodeInstanceRepository.persistOnExit(token, flowNodeId, flowNodeInstanceId);
  }

  public async persistOnError(executionContextFacade: IExecutionContextFacade,
                              token: Runtime.Types.ProcessToken,
                              flowNodeId: string,
                              flowNodeInstanceId: string,
                              error: Error,
                             ): Promise<Runtime.Types.FlowNodeInstance> {

    return this.flowNodeInstanceRepository.persistOnError(token, flowNodeId, flowNodeInstanceId, error);
  }

  public async persistOnTerminate(executionContextFacade: IExecutionContextFacade,
                                  token: Runtime.Types.ProcessToken,
                                  flowNodeId: string,
                                  flowNodeInstanceId: string,
                                 ): Promise<Runtime.Types.FlowNodeInstance> {

    return this.flowNodeInstanceRepository.persistOnTerminate(token, flowNodeId, flowNodeInstanceId);
  }

  public async suspend(executionContextFacade: IExecutionContextFacade,
                       token: Runtime.Types.ProcessToken,
                       flowNodeInstanceId: string,
                       correlationHash?: string,
                      ): Promise<Runtime.Types.FlowNodeInstance> {

    return this.flowNodeInstanceRepository.suspend(token, flowNodeInstanceId, correlationHash);
  }

  public async resume(executionContextFacade: IExecutionContextFacade, flowNodeInstanceId: string): Promise<Runtime.Types.FlowNodeInstance> {
    return this.flowNodeInstanceRepository.resume(flowNodeInstanceId);
  }

}
