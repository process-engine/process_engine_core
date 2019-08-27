import {IIdentity} from '@essential-projects/iam_contracts';
import {Correlation} from '@process-engine/correlation.contracts';

export class CorrelationServiceMock {

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

  public async getByProcessInstanceId(identity: IIdentity, processInstanceId: string): Promise<Correlation> {
    return Promise.resolve({} as any);
  }

  public async getSubprocessesForProcessInstance(identity: IIdentity, processInstanceId: string): Promise<Correlation> {
    return Promise.resolve({} as any);
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

}
