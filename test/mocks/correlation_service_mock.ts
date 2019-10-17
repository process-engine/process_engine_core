import {IIdentity} from '@essential-projects/iam_contracts';
import {
  Correlation,
  CorrelationState,
  ICorrelationService,
  ProcessInstance,
} from '@process-engine/persistence_api.contracts';

export class CorrelationServiceMock implements ICorrelationService {

  public async createEntry(
    identity: IIdentity,
    correlationId: string,
    processInstanceId: string,
    processModelId: string,
    processModelHash: string,
    parentProcessInstanceId?: string,
  ): Promise<void> {
    return Promise.resolve();
  }

  public async getAll(identity: IIdentity): Promise<Array<Correlation>> {
    return Promise.resolve([]);
  }

  public async getActive(identity: IIdentity): Promise<Array<Correlation>> {
    return Promise.resolve([]);
  }

  public async getByCorrelationId(identity: IIdentity, correlationId: string): Promise<Correlation> {
    return Promise.resolve({} as any);
  }

  public async getByProcessModelId(identity: IIdentity, processModelId: string): Promise<Array<Correlation>> {
    return Promise.resolve([]);
  }

  public async getByProcessInstanceId(identity: IIdentity, processInstanceId: string): Promise<ProcessInstance> {
    return Promise.resolve({} as any);
  }

  public async getSubprocessesForProcessInstance(identity: IIdentity, processInstanceId: string): Promise<Array<ProcessInstance>> {
    return Promise.resolve([]);
  }

  public async deleteCorrelationByProcessModelId(identity: IIdentity, processModelId: string): Promise<void> {
    return Promise.resolve();
  }

  public async finishProcessInstanceInCorrelation(identity: IIdentity, correlationId: string, processInstanceId: string): Promise<void> {
    return Promise.resolve();
  }

  public async finishProcessInstanceInCorrelationWithError(
    identity: IIdentity,
    correlationId: string,
    processInstanceId: string,
    error: Error,
  ): Promise<void> {
    return Promise.resolve();
  }

  public async getProcessInstancesForCorrelation(
    identity: IIdentity,
    correlationId: string,
    offset?: number,
    limit?: number,
  ): Promise<Array<ProcessInstance>> {
    return Promise.resolve([]);
  }

  public async getProcessInstancesForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset?: number,
    limit?: number,
  ): Promise<Array<ProcessInstance>> {
    return Promise.resolve([]);
  }

  public async getProcessInstancesByState(
    identity: IIdentity,
    state: CorrelationState,
    offset?: number,
    limit?: number,
  ): Promise<Array<ProcessInstance>> {
    return Promise.resolve([]);
  }

}
