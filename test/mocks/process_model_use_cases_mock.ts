import {IIdentity} from '@essential-projects/iam_contracts';
import {Model, ProcessDefinitionFromRepository} from '@process-engine/persistence_api.contracts';

export class ProcessModelUseCasesMock {

  public persistProcessDefinitions(identity: IIdentity, name: string, xml: string, overwriteExisting?: boolean): Promise<void> {
    return Promise.resolve();
  }

  public getProcessModelById(identity: IIdentity, processModelId: string): Promise<Model.Process> {
    return Promise.resolve({} as any);
  }

  public getProcessModelByProcessInstanceId(identity: IIdentity, processInstanceId: string): Promise<Model.Process> {
    return Promise.resolve({} as any);
  }

  public getProcessDefinitionAsXmlByName(identity: IIdentity, name: string): Promise<ProcessDefinitionFromRepository> {
    return Promise.resolve({} as any);
  }

  public getByHash(identity: IIdentity, processModelId: string, hash: string): Promise<Model.Process> {
    return Promise.resolve({} as any);
  }

  public getProcessModels(identity: IIdentity): Promise<Array<Model.Process>> {
    return Promise.resolve([]);
  }

  public deleteProcessModel(identity: IIdentity, processModelId: string): Promise<void> {
    return Promise.resolve();
  }

}
