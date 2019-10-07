import {Model, ProcessToken} from '@process-engine/persistence_api.contracts';
import {IFlowNodePersistenceFacade} from '@process-engine/process_engine_contracts';

export class FlowNodePersistenceFacadeMock implements IFlowNodePersistenceFacade {

  public async persistOnEnter(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
    previousFlowNodeInstanceId?: string,
  ): Promise<void> {
    return Promise.resolve();
  }

  public async persistOnExit(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
  ): Promise<void> {
    return Promise.resolve();
  }

  public async persistOnTerminate(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
  ): Promise<void> {
    return Promise.resolve();
  }

  public async persistOnError(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
    error: Error,
  ): Promise<void> {
    return Promise.resolve();
  }

  public async persistOnSuspend(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
  ): Promise<void> {
    return Promise.resolve();
  }

  public async persistOnResume(
    flowNode: Model.Base.FlowNode,
    flowNodeInstanceId: string,
    processToken: ProcessToken,
  ): Promise<void> {
    return Promise.resolve();
  }

}
