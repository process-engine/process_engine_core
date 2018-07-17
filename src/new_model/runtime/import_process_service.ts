import {
  ExecutionContext,
  IExecutionContextFacade,
  IImportProcessService,
  IModelParser,
  IProcessDefinitionRepository,
  IProcessModelService,
} from '@process-engine/process_engine_contracts';

import {IIdentity} from '@essential-projects/iam_contracts';

import {InvocationContainer} from 'addict-ioc';
import * as fs from 'fs';

import {IamServiceMock} from '../../iam_service_mock';
import {ExecutionContextFacade} from './engine/index';
import {ProcessModelService} from './persistence/index';

export class ImportProcessService implements IImportProcessService {

  private _container: InvocationContainer;
  private _bpmnModelParser: IModelParser;
  private _processModelService: IProcessModelService;

  constructor(container: InvocationContainer, bpmnModelParser: IModelParser) {
    this._container = container;
    this._bpmnModelParser = bpmnModelParser;
  }

  private get bpmnModelParser(): IModelParser {
    return this._bpmnModelParser;
  }

  private get processModelService(): IProcessModelService {
    return this._processModelService;
  }

  public async initialize(): Promise<void> {

    const processModelPeristanceRepository: IProcessDefinitionRepository =
      await this._container.resolveAsync<IProcessDefinitionRepository>('ProcessDefinitionRepository');

    // TODO: Must be removed, as soon as the process engine can authenticate itself against the external authority.
    const iamService: IamServiceMock = new IamServiceMock();
    this._processModelService = new ProcessModelService(processModelPeristanceRepository, iamService, this.bpmnModelParser);
  }

  public async importBpmnFromXml(context: ExecutionContext, xml: string, name: string, overwriteExisting: boolean = true): Promise<void> {

    const identity: IIdentity = {
      token: context.encryptedToken,
    };

    const newExecutionContext: ExecutionContext = new ExecutionContext(identity);

    const executionContextFacade: IExecutionContextFacade = new ExecutionContextFacade(newExecutionContext);

    await this.processModelService.persistProcessDefinitions(executionContextFacade, name, xml, overwriteExisting);
  }

  public async importBpmnFromFile(context: ExecutionContext, filePath: string, overwriteExisting: boolean = true): Promise<void> {

    if (!filePath) {
      throw new Error('file does not exist');
    }

    const name: string = filePath.split('/').pop();
    const xml: string = await this._getXmlFromFile(filePath);

    await this.importBpmnFromXml(context, name, xml, overwriteExisting);
  }

  private async _getXmlFromFile(path: string): Promise<string> {
    return new Promise<string>((resolve: Function, reject: Function): void => {
      fs.readFile(path, 'utf8', (error: Error, xmlString: string): void => {
        if (error) {
          reject(error);
        } else {
          resolve(xmlString);
        }
      });
    });
}
}
