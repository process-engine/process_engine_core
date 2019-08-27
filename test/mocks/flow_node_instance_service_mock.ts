import {FlowNode, FlowNodeInstanceState, ProcessToken} from '@process-engine/process_engine_contracts';

export class FlowNodeInstanceServiceMock {

  public persistOnEnter(flowNode: FlowNode, flowNodeInstanceId: string, token: ProcessToken, previousFlowNodeInstanceId?: string): Promise<any> {
    return Promise.resolve();
  }

  public persistOnExit(flowNode: FlowNode, flowNodeInstanceId: string, token: ProcessToken): Promise<any> {
    return Promise.resolve();
  }

  public persistOnError(flowNode: FlowNode, flowNodeInstanceId: string, token: ProcessToken, error: Error): Promise<any> {
    return Promise.resolve();
  }

  public persistOnTerminate(flowNode: FlowNode, flowNodeInstanceId: string, token: ProcessToken): Promise<any> {
    return Promise.resolve();
  }

  public suspend(flowNodeId: string, flowNodeInstanceId: string, token: ProcessToken): Promise<any> {
    return Promise.resolve();
  }

  public resume(flowNodeId: string, flowNodeInstanceId: string, token: ProcessToken): Promise<any> {
    return Promise.resolve();
  }

  public querySpecificFlowNode(correlationId: string, processModelId: string, flowNodeId: string): Promise<any> {
    return Promise.resolve();
  }

  public queryFlowNodeInstancesByProcessInstanceId(processInstanceId: string, flowNodeId: string): Promise<any> {
    return Promise.resolve();
  }

  public queryByFlowNodeId(flowNodeId: string): Promise<any> {
    return Promise.resolve();
  }

  public queryByInstanceId(flowNodeInstanceId: string): Promise<any> {
    return Promise.resolve();
  }

  public queryByCorrelation(correlationId: string): Promise<any> {
    return Promise.resolve();
  }

  public queryByProcessModel(processModelId: string): Promise<any> {
    return Promise.resolve();
  }

  public queryByCorrelationAndProcessModel(correlationId: string, processModelId: string): Promise<any> {
    return Promise.resolve();
  }

  public queryByProcessInstance(processInstanceId: string): Promise<any> {
    return Promise.resolve();
  }

  public queryByState(state: FlowNodeInstanceState): Promise<any> {
    return Promise.resolve();
  }

  public queryActive(): Promise<any> {
    return Promise.resolve();
  }

  public queryActiveByProcessInstance(processInstanceId: string): Promise<any> {
    return Promise.resolve();
  }

  public queryActiveByCorrelationAndProcessModel(correlationId: string, processModelId: string): Promise<any> {
    return Promise.resolve();
  }

  public querySuspendedByCorrelation(correlationId: string): Promise<any> {
    return Promise.resolve();
  }

  public querySuspendedByProcessModel(processModelId: string): Promise<any> {
    return Promise.resolve();
  }

  public querySuspendedByProcessInstance(processInstanceId: string): Promise<any> {
    return Promise.resolve();
  }

  public queryProcessTokensByProcessInstanceId(processInstanceId: string): Promise<any> {
    return Promise.resolve();
  }

  public deleteByProcessModelId(processModelId: string): Promise<any> {
    return Promise.resolve();
  }

}
