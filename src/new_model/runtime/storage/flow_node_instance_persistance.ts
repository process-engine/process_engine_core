import {IFlowNodeInstancePersistance, Runtime} from '@process-engine/process_engine_contracts';

interface IPersistedFlowNodeInstance {
  token: Runtime.Types.ProcessToken;
  flowNodeId: string;
  flowNodeInstanceId: string;
  isSuspended: boolean;
}

export class FlowNodeInstancePersistance implements IFlowNodeInstancePersistance {

  private _persistedFlowNodes: Map<string, IPersistedFlowNodeInstance> = new Map<string, IPersistedFlowNodeInstance>();

  private get persistedFlowNodes(): Map<string, IPersistedFlowNodeInstance> {
    return this._persistedFlowNodes;
  }

  public async queryByCorrelation(correlationId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {
    const persistedFlowNodes: Array<IPersistedFlowNodeInstance> = Array.from(this.persistedFlowNodes.values());
    const filteredFlowNodes: Array<IPersistedFlowNodeInstance> = persistedFlowNodes.filter((persistedFlowNode: IPersistedFlowNodeInstance) => {
      return persistedFlowNode.token.correlationId === correlationId;
    });

    return filteredFlowNodes.map((persistedFlowNode: IPersistedFlowNodeInstance) => {
      return this._createFlowNodeInstance(persistedFlowNode);
    });
  }

  public async queryByProcessModel(processModelId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {
    const persistedFlowNodes: Array<IPersistedFlowNodeInstance> = Array.from(this.persistedFlowNodes.values());
    const filteredFlowNodes: Array<IPersistedFlowNodeInstance> = persistedFlowNodes.filter((persistedFlowNode: IPersistedFlowNodeInstance) => {
      return persistedFlowNode.token.processModelId === processModelId;
    });

    return filteredFlowNodes.map((persistedFlowNode: IPersistedFlowNodeInstance) => {
      return this._createFlowNodeInstance(persistedFlowNode);
    });
  }

  public async querySuspendedByCorrelation(correlationId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {
    const persistedFlowNodes: Array<IPersistedFlowNodeInstance> = Array.from(this.persistedFlowNodes.values());
    const filteredFlowNodes: Array<IPersistedFlowNodeInstance> = persistedFlowNodes.filter((persistedFlowNode: IPersistedFlowNodeInstance) => {
      return persistedFlowNode.token.correlationId === correlationId
        && persistedFlowNode.isSuspended === true;
    });

    return filteredFlowNodes.map((persistedFlowNode: IPersistedFlowNodeInstance) => {
      return this._createFlowNodeInstance(persistedFlowNode);
    });
  }

  public async querySuspendedByProcessModel(processModelId: string): Promise<Array<Runtime.Types.FlowNodeInstance>> {
    const persistedFlowNodes: Array<IPersistedFlowNodeInstance> = Array.from(this.persistedFlowNodes.values());
    const filteredFlowNodes: Array<IPersistedFlowNodeInstance> = persistedFlowNodes.filter((persistedFlowNode: IPersistedFlowNodeInstance) => {
      return persistedFlowNode.token.processModelId === processModelId
        && persistedFlowNode.isSuspended === true;
    });

    return filteredFlowNodes.map((persistedFlowNode: IPersistedFlowNodeInstance) => {
      return this._createFlowNodeInstance(persistedFlowNode);
    });
  }

  public async persistOnEnter(token: Runtime.Types.ProcessToken,
                              flowNodeId: string,
                              flowNodeInstanceId: string): Promise<Runtime.Types.FlowNodeInstance> {

    const persistedFlowNode: IPersistedFlowNodeInstance = {
      token: token,
      flowNodeId: flowNodeId,
      flowNodeInstanceId: flowNodeInstanceId,
      isSuspended: false,
    };

    this.persistedFlowNodes.set(flowNodeInstanceId, persistedFlowNode);

    const flowNodeInstance: Runtime.Types.FlowNodeInstance = this._createFlowNodeInstance(persistedFlowNode);

    return Promise.resolve(flowNodeInstance);
  }

  public async persistOnExit(token: Runtime.Types.ProcessToken,
                             flowNodeId: string,
                             flowNodeInstanceId: string): Promise<Runtime.Types.FlowNodeInstance> {

    const persistedFlowNode: IPersistedFlowNodeInstance = this.persistedFlowNodes.get(flowNodeInstanceId);

    if (!persistedFlowNode) {
      throw new Error(`flow node with id "${flowNodeId}" and instance id "${flowNodeInstanceId}" could not be saved`);
    }

    persistedFlowNode.token = token;

    const flowNodeInstance: Runtime.Types.FlowNodeInstance = this._createFlowNodeInstance(persistedFlowNode);

    return Promise.resolve(flowNodeInstance);
  }

  public async suspend(token: Runtime.Types.ProcessToken,
                       flowNodeInstanceId: string,
                       correlationHash?: string): Promise<Runtime.Types.FlowNodeInstance> {

    const persistedFlowNode: IPersistedFlowNodeInstance = this.persistedFlowNodes.get(flowNodeInstanceId);

    if (!persistedFlowNode) {
      throw new Error(`flow node with instance id "${flowNodeInstanceId}" could not be saved`);
    }

    persistedFlowNode.token = token;
    persistedFlowNode.isSuspended = true;

    const flowNodeInstance: Runtime.Types.FlowNodeInstance = this._createFlowNodeInstance(persistedFlowNode);

    return Promise.resolve(flowNodeInstance);
  }

  public async resume(flowNodeInstanceId: string): Promise<Runtime.Types.FlowNodeInstance> {

    const persistedFlowNode: IPersistedFlowNodeInstance = this.persistedFlowNodes.get(flowNodeInstanceId);

    if (!persistedFlowNode) {
      throw new Error(`flow node with instance id "${flowNodeInstanceId}" could not be saved`);
    }

    persistedFlowNode.isSuspended = false;

    const flowNodeInstance: Runtime.Types.FlowNodeInstance = this._createFlowNodeInstance(persistedFlowNode);

    return Promise.resolve(flowNodeInstance);
  }

  private _createFlowNodeInstance(persistedFlowNodeInstance: IPersistedFlowNodeInstance): Runtime.Types.FlowNodeInstance {

    const flowNodeInstance: Runtime.Types.FlowNodeInstance = new Runtime.Types.FlowNodeInstance();

    flowNodeInstance.id = persistedFlowNodeInstance.flowNodeInstanceId;
    flowNodeInstance.flowNodeId = persistedFlowNodeInstance.flowNodeId;
    flowNodeInstance.token = persistedFlowNodeInstance.token;

    return flowNodeInstance;
  }

}
