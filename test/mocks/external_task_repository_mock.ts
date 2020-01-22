import {IIdentity} from '@essential-projects/iam_contracts';

import {ExternalTask, IExternalTaskRepository} from '@process-engine/persistence_api.contracts';

export class ExternalTaskRepositoryMock implements IExternalTaskRepository {

  public async create<TPayload>(
    topic: string,
    correlationId: string,
    processModelId: string,
    processInstanceId: string,
    flowNodeInstanceId: string,
    identity: IIdentity,
    payload: TPayload,
  ): Promise<void> {
    return Promise.resolve();
  }

  public async getById<TPayload>(externalTaskId: string): Promise<ExternalTask<TPayload>> {
    return Promise.resolve({} as any);
  }

  public async getByInstanceIds<TPayload>(
    correlationId: string,
    processInstanceId: string,
    flowNodeInstanceId: string,
  ): Promise<ExternalTask<TPayload>> {
    return Promise.resolve({} as any);
  }

  public async fetchAvailableForProcessing<TPayload>(topicName: string, maxTasks: number): Promise<Array<ExternalTask<TPayload>>> {
    return Promise.resolve([]);
  }

  public async lockForWorker(workerId: string, externalTaskId: string, lockExpirationTime: Date): Promise<void> {
    return Promise.resolve();
  }

  public async finishWithError(externalTaskId: string, error: Error): Promise<void> {
    return Promise.resolve();
  }

  public async finishWithSuccess<TResultType>(externalTaskId: string, result: TResultType): Promise<void> {
    return Promise.resolve();
  }

  public async deleteExternalTasksByProcessModelId(processModelId: string): Promise<void> {
    return Promise.resolve();
  }

}
