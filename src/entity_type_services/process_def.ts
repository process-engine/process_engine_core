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
  IProcessDefEntityTypeService, IProcessRepository,
} from '@process-engine/process_engine_contracts';
import { BpmnDiagram } from '../bpmn_diagram';

import * as BluebirdPromise from 'bluebird';
import * as BpmnModdle from 'bpmn-moddle';

// tslint:disable:cyclomatic-complexity
export class ProcessDefEntityTypeService implements IProcessDefEntityTypeService {

  private _datastoreService: IDatastoreService = undefined;
  private _processRepository: IProcessRepository = undefined;
  private _invoker: IInvoker = undefined;

  constructor(datastoreService: IDatastoreService, processRepository: IProcessRepository, invoker: IInvoker) {
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

    const overwriteExisting: boolean = options && options.hasOwnProperty('overwriteExisting') ? options.overwriteExisting : true;

    const xml = params && params.xml ? params.xml : null;
    const internalName = params && params.internalName ? params.internalName : null;
    const pathString = params && params.path ? params.path : null;
    const category = params && params.category ? params.category : null;
    const module = params && params.module ? params.module : null;
    const readonly = params && params.readonly ? params.readonly : null;

    if (!xml) {
      return;
    }

    const bpmnDiagram: BpmnDiagram = await this.parseBpmnXml(xml);
    const processDef: IEntityType<IProcessDefEntity> = await this.datastoreService.getEntityType<IProcessDefEntity>('ProcessDef');
    const processes: any = bpmnDiagram.getProcesses();

    for (const process of processes) {

      // query with key
      const queryParams: IPrivateQueryOptions = {
        query: {
          attribute: 'key',
          operator: '=',
          value: process.id,
        },
      };
      const processDefColl: IEntityCollection<IProcessDefEntity> = await processDef.query(context, queryParams);

      let processDefEntity: IProcessDefEntity = processDefColl && processDefColl.length > 0 ? processDefColl.data[0] as IProcessDefEntity : null;

      let canSave: boolean = false;
      if (!processDefEntity) {
        const processDefData: any = {
          key: process.id,
          defId: bpmnDiagram.definitions.id,
          counter: 0,
        };

        processDefEntity = await processDef.createEntity(context, processDefData);

        // always create new processes
        canSave = true;
      } else {
        // check if we can overwrite existing processes
        canSave = overwriteExisting;
      }

      if (!canSave) {
        continue;
      }

      processDefEntity.name = process.name;
      processDefEntity.xml = xml;
      processDefEntity.internalName = internalName;
      processDefEntity.path = pathString;
      processDefEntity.category = category;
      processDefEntity.module = module;
      processDefEntity.readonly = readonly;
      processDefEntity.counter = processDefEntity.counter + 1;

      await this.invoker.invoke(processDefEntity, 'updateDefinitions', undefined, context, context, { bpmnDiagram: bpmnDiagram });
      await processDefEntity.save(context, {isNew: false});
    }
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

  public async getProcessDefinitionByName(context: ExecutionContext,
    processDefinitionName: string,
    version?: string,
    versionlessFallback: boolean = false): Promise<IProcessDefEntity> {

    if (!version) {
      return this._getByAttribute(context, 'name', processDefinitionName);
    }

    let result: IProcessDefEntity = await this._getByAttributeAndVersion(context, 'name', processDefinitionName, version);

    if (!result && versionlessFallback) {
      // We didn't find any versionized processDefinition, but versionlessFallback is true, so try getting one without a version
      result = await this._getByAttribute(context, 'name', processDefinitionName);
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
