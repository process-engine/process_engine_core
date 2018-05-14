import {
  ExecutionContext,
  ICombinedQueryClause,
  IEntityReference,
  IPrivateQueryOptions,
  IPublicGetOptions,
  IQueryClause,
} from '@essential-projects/core_contracts';
import { IDatastoreService, IEntityCollection, IEntityType } from '@essential-projects/data_model_contracts';
import { IInvoker } from '@essential-projects/invocation_contracts';
import {
  IImportFromFileOptions, IImportFromXmlOptions, IParamImportFromFile,
  IParamImportFromXml, IParamStart, IProcessDefEntity,
  IProcessDefEntityTypeService, IProcessRepository, IModelParser, Definitions
} from '@process-engine/process_engine_contracts';
import { BpmnDiagram } from '../bpmn_diagram';
import { IProcessEngineStorageService } from './../index';

import * as BluebirdPromise from 'bluebird';
import * as BpmnModdle from 'bpmn-moddle';

// tslint:disable:cyclomatic-complexity
export class ProcessDefEntityTypeService implements IProcessDefEntityTypeService {

  private _datastoreService: IDatastoreService = undefined;
  private _processRepository: IProcessRepository = undefined;
  private _invoker: IInvoker = undefined;
  private _bpmnModelParser: IModelParser = undefined;
  private _processEngineStorageService: IProcessEngineStorageService = undefined;

  constructor(datastoreService: IDatastoreService, processRepository: IProcessRepository, invoker: IInvoker, bpmnModelParser: IModelParser, processEngineStorageService: IProcessEngineStorageService) {
    this._datastoreService = datastoreService;
    this._processRepository = processRepository;
    this._invoker = invoker;
    this._bpmnModelParser = bpmnModelParser;
    this._processEngineStorageService = processEngineStorageService;
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

  private get bpmnModelParser(): IModelParser {
    return this._bpmnModelParser;
  }

  private get processEngineStorageService(): IProcessEngineStorageService {
    return this._processEngineStorageService;
  }

  public async importBpmnFromFile(context: ExecutionContext, params: IParamImportFromFile, options?: IImportFromFileOptions): Promise<any> {

    const path: string = params && params.file ? params.file : null;
    if (path) {

      const xml: string = await this.processRepository.getXmlFromFile(path);
      const name: string = path.split('/').pop();
      await this.importBpmnFromXml(
        context,
        {
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
    
    const xml = params && params.xml ? params.xml : null;
    const definitions: Definitions = await this.bpmnModelParser.parseXmlToObjectModel(xml);
    await this.processEngineStorageService.saveDefinitions(definitions);

      // await this.invoker.invoke(processDefEntity, 'updateDefinitions', undefined, context, context, { bpmnDiagram: bpmnDiagram });
      // await processDefEntity.save(context, {isNew: false});
  }

  public parseBpmnXml(xml: string): Promise<BpmnDiagram> {

    const moddle: BpmnModdle = BpmnModdle();

    return <any> (new BluebirdPromise<BpmnDiagram>((resolve: Function, reject: Function): void => {

      moddle.fromXML(xml, (error: Error, definitions: any) => {
        if (error) {
          reject(error);
        } else {

          const bpmnDiagram: BpmnDiagram = new BpmnDiagram(definitions);
          resolve(bpmnDiagram);
        }
      });
    }));
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
