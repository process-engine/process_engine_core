import {
  ExecutionContext,
  ICombinedQueryClause,
  IEntityReference,
  IPrivateQueryOptions,
  IPublicGetOptions,
  IQueryClause,
} from '@essential-projects/core_contracts';
import {IDatastoreService, IEntityCollection, IEntityType} from '@essential-projects/data_model_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {IInvoker} from '@essential-projects/invocation_contracts';
import {
  ExecutionContext as NewExecutionContext,
  IExecutionContextFacade,
  IImportFromFileOptions,
  IImportFromXmlOptions,
  IModelParser,
  IParamImportFromFile,
  IParamImportFromXml,
  IParamStart,
  IProcessDefEntity,
  IProcessDefEntityTypeService,
  IProcessDefinitionRepository,
  IProcessModelService,
  IProcessRepository,
} from '@process-engine/process_engine_contracts';

import {InvocationContainer} from 'addict-ioc';
import * as BpmnModdle from 'bpmn-moddle';

import {BpmnDiagram} from '../bpmn_diagram';
import {IamServiceMock} from '../iam_service_mock';
import {ExecutionContextFacade} from '../new_model/runtime/engine/index';
import {ProcessModelService} from '../new_model/runtime/persistence/index';

// tslint:disable:cyclomatic-complexity
export class ProcessDefEntityTypeService implements IProcessDefEntityTypeService {

  private _datastoreService: IDatastoreService = undefined;
  private _processRepository: IProcessRepository = undefined;
  private _invoker: IInvoker = undefined;
  private _processModelService: IProcessModelService = undefined;

  private _container: InvocationContainer;

  constructor(container: InvocationContainer,
              datastoreService: IDatastoreService,
              processRepository: IProcessRepository,
              invoker: IInvoker) {

    this._container = container;
    this._datastoreService = datastoreService;
    this._processRepository = processRepository;
    this._invoker = invoker;
  }

  // TODO: Heiko Mathes - replaced lazy datastoreService-injection with regular injection. is this ok?
  private get datastoreService(): IDatastoreService {
    return this._datastoreService;
  }

  private get invoker(): IInvoker {
    return this._invoker;
  }

  private get processRepository(): IProcessRepository {
    return this._processRepository;
  }

  private get processModelService(): IProcessModelService {
    return this._processModelService;
  }

  public async initialize(): Promise<void> {

    const processModelPeristanceRepository: IProcessDefinitionRepository =
      await this._container.resolveAsync<IProcessDefinitionRepository>('ProcessDefinitionRepository');

    const bpmnModelParser: IModelParser = await this._container.resolveAsync<IModelParser>('BpmnModelParser');

    // TODO: Must be removed, as soon as the process engine can authenticate itself against the external authority.
    const iamService: IamServiceMock = new IamServiceMock();
    this._processModelService = new ProcessModelService(processModelPeristanceRepository, iamService, bpmnModelParser);
  }

  public async importBpmnFromFile(context: ExecutionContext, params: IParamImportFromFile, options?: IImportFromFileOptions): Promise<any> {

    const path: string = params && params.file ? params.file : null;
    if (path) {

      const xml: string = await this.processRepository.getXmlFromFile(path);
      const name: string = path.split('/').pop();
      await this.importBpmnFromXml(
        context,
        {
          name: name,
          xml: xml,
          path: path,
          internalName: name,
        },
        options);

      return { result: true };

    }

    throw new Error('file does not exist');
  }

  public async importBpmnFromXml(context: ExecutionContext, params: IParamImportFromXml, options?: IImportFromXmlOptions): Promise<void> {

    const name: string = params && params.name ? params.name : null;
    const internalName: string = params && params.internalName ? params.internalName : null;
    const xml: string = params && params.xml ? params.xml : null;
    const overwriteExisting: boolean = options && options.hasOwnProperty('overwriteExisting') ? options.overwriteExisting : true;

    const identity: IIdentity = {
      token: context.encryptedToken,
    };

    const newExecutionContext: NewExecutionContext = new NewExecutionContext(identity);

    const executionContextFacade: IExecutionContextFacade = new ExecutionContextFacade(newExecutionContext);

    await this.processModelService.persistProcessDefinitions(executionContextFacade, name || internalName, xml, overwriteExisting);
  }

  public parseBpmnXml(xml: string): Promise<BpmnDiagram> {

    const moddle: BpmnModdle = BpmnModdle();

    return new Promise((resolve: Function, reject: Function): void => {

      moddle.fromXML(xml, (error: Error, definitions: any) => {
        if (error) {
          reject(error);
        } else {

          const bpmnDiagram: BpmnDiagram = new BpmnDiagram(definitions);
          resolve(bpmnDiagram);
        }
      });
    });
  }

  public async start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<IEntityReference> {

    if (params === undefined || params === null) {
      return;
    }
    const key: string = params ? params.key : undefined;
    const processId: string = params ? params.id : undefined;

    if (!key && !processId) {
      return null;
    }

    const version: string = params ? params.version : undefined;

    let processDefEntity: IProcessDefEntity;

    processDefEntity = await this._find(context, processId, key, version);

    if (!processDefEntity) {
      // Backwards compatibility
      processDefEntity = await this._findByKeyOnly(context, processId, key);
    }

    if (processDefEntity) {
      return <Promise<IEntityReference>> this.invoker.invoke(processDefEntity, 'start', undefined, context, context, params, options);
    }
  }

  private async _find(context: ExecutionContext, processId: string, key: string, version: string): Promise<IProcessDefEntity> {

    const queryObject: ICombinedQueryClause = {
      operator: 'and',
      queries: [
        {
          attribute: processId ? 'id' : 'key',
          operator: '=',
          value: processId || key,
        },
      ],
    };

    if (version) {
      queryObject.queries.push({
        attribute: 'version',
        operator: '=',
        value: version,
      });
    }

    const processDef: IEntityType<IProcessDefEntity> = await this.datastoreService.getEntityType<IProcessDefEntity>('ProcessDef');

    return processDef.findOne(context, { query: queryObject });
  }

  private async _findByKeyOnly(context: ExecutionContext, processId: string, key: string): Promise<IProcessDefEntity> {
    const processDef: IEntityType<IProcessDefEntity> = await this.datastoreService.getEntityType<IProcessDefEntity>('ProcessDef');
    const queryObjectKeyOnly: IQueryClause = {
      attribute: (processId ? 'id' : 'key'),
      operator: '=',
      value: (processId ? processId : key),
    };

    return processDef.findOne(context, { query: queryObjectKeyOnly });
  }

  public async getProcessDefinitionByKey(context: ExecutionContext,
                                         processDefinitionKey: string,
                                         version?: string,
                                         versionlessFallback: boolean = false): Promise<IProcessDefEntity> {

    if (!version) {
      return this._getByAttribute(context, 'key', processDefinitionKey);
    }

    let result: IProcessDefEntity = await this._getByAttributeAndVersion(context, 'key', processDefinitionKey, version);

    if (!result && versionlessFallback) {
      // We didn't find any versionized processDefinition, but versionlessFallback is true, so try getting one without a version
      result = await this._getByAttribute(context, 'key', processDefinitionKey);
    }

    return result;
  }

  public async getProcessDefinitionById(context: ExecutionContext,
                                        processDefinitionId: string,
                                        version?: string,
                                        versionlessFallback: boolean = false): Promise<IProcessDefEntity> {

    if (!version) {
      return this._getByAttribute(context, 'id', processDefinitionId);
    }

    let result: IProcessDefEntity = await this._getByAttributeAndVersion(context, 'id', processDefinitionId, version);

    if (!result && versionlessFallback) {
      // We didn't find any versionized processDefinition, but versionlessFallback is true, so try getting one without a version
      result = await this._getByAttribute(context, 'id', processDefinitionId);
    }

    return result;
  }

  private async _getByAttributeAndVersion(
      context: ExecutionContext,
      attributeName: string,
      attributeValue: any,
      version: string,
    ): Promise<IProcessDefEntity> {

    const query: IPrivateQueryOptions = {
      query: {
        operator: 'and',
        queries: [{
          attribute: attributeName,
          operator: '=',
          value: attributeValue,
        }, {
          attribute: 'version',
          operator: '=',
          value: version,
        }],
      },
    };

    const processDefinitionEntityType: IEntityType<IProcessDefEntity> = await this.datastoreService.getEntityType<IProcessDefEntity>('ProcessDef');
    const result: IProcessDefEntity = await processDefinitionEntityType.findOne(context, query);

    return result;
  }

  private async _getByAttribute(context: ExecutionContext, attributeName: string, attributeValue: any): Promise<IProcessDefEntity> {

    const query: IPrivateQueryOptions = {
      query: {
        attribute: attributeName,
        operator: '=',
        value: attributeValue,
      },
    };

    const processDefinitionEntityType: IEntityType<IProcessDefEntity> = await this.datastoreService.getEntityType<IProcessDefEntity>('ProcessDef');
    const result: IProcessDefEntity = await processDefinitionEntityType.findOne(context, query);

    return result;
  }
}
