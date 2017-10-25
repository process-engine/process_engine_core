import {
  ExecutionContext,
  ICombinedQueryClause,
  IEntityReference,
  IPrivateQueryOptions,
  IPublicGetOptions,
  IQueryClause,
} from '@essential-projects/core_contracts';
import { IDatastoreService, IEntityType } from '@essential-projects/data_model_contracts';
import { IInvoker } from '@essential-projects/invocation_contracts';
import {
  IImportFromFileOptions, IImportFromXmlOptions, IParamImportFromFile,
  IParamImportFromXml, IParamStart, IProcessDefEntity,
  IProcessDefEntityTypeService, IProcessRepository,
} from '@process-engine/process_engine_contracts';
import { BpmnDiagram } from '../bpmn_diagram';

import * as BluebirdPromise from 'bluebird';
import * as BpmnModdle from 'bpmn-moddle';

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

    const pathString = params && params.file ? params.file : null;
    if (pathString) {

      const xmlString = await this.processRepository.getXmlFromFile(pathString);
      const name = pathString.split('/').pop();
      await this.importBpmnFromXml(
        context,
        {
          xml: xmlString,
          path: pathString,
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

    const bpmnDiagram = await this.parseBpmnXml(xml);
    const processDef = await this.datastoreService.getEntityType<IProcessDefEntity>('ProcessDef');
    const processes = bpmnDiagram.getProcesses();

    for (let i = 0; i < processes.length; i++) {
      const process = processes[i];

      // query with key
      const queryObject: ICombinedQueryClause = {
        operator: 'and',
        queries: [
          {
            attribute: 'key',
            operator: '=',
            value: process.id,
          },
          {
            attribute: 'latest',
            operator: '=',
            value: true,
          },
        ],
      };
      const queryParams: IPrivateQueryOptions = { query: queryObject };
      const processDefColl = await processDef.query(context, queryParams);

      let processDefEntity: IProcessDefEntity = processDefColl && processDefColl.length > 0 ? processDefColl.data[0] as IProcessDefEntity : null;

      let canSave = false;
      if (!processDefEntity) {

        const processDefData = {
          key: process.id,
          defId: bpmnDiagram.definitions.id,
          counter: 0,
          latest: true,
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
    }
  }

  public parseBpmnXml(xml: string): Promise<BpmnDiagram> {

    const moddle = BpmnModdle();

    return <any> (new BluebirdPromise<BpmnDiagram>((resolve, reject) => {

      moddle.fromXML(xml, (error, definitions) => {
        if (error) {
          reject(error);
        } else {

          const bpmnDiagram = new BpmnDiagram(definitions);
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

    processDefEntity = await this._findLatest(context, processId, key, version);

    if (!processDefEntity) {
      // no process def with flag latest is found, for backwards compability we only query with key
      processDefEntity = await this._findByKeyOnly(context, processId, key);
    }

    if (processDefEntity) {
      return <Promise<IEntityReference>>this.invoker.invoke(processDefEntity, 'start', undefined, context, context, params, options);
    }
  }

  private async _findLatest(context: ExecutionContext, processId: string, key: string, version: string): Promise<IProcessDefEntity> {

    let attributeName: string = 'key';
    let attributeValue: string = key;

    if (processId) {
      attributeName = 'id';
      attributeValue = processId;
    }

    const queryObjectLatestVersion: ICombinedQueryClause = {
      operator: 'and',
      queries: [
        {
          attribute: attributeName,
          operator: '=',
          value: attributeValue,
        },
      ],
    };

    if (version) {
      queryObjectLatestVersion.queries.push({
        attribute: 'version',
        operator: '=',
        value: version,
      });
    } else {
      queryObjectLatestVersion.queries.push({
        attribute: 'latest',
        operator: '=',
        value: true,
      });
    }

    const processDef: IEntityType<IProcessDefEntity> = await this.datastoreService.getEntityType<IProcessDefEntity>('ProcessDef');

    return await processDef.findOne(context, { query: queryObjectLatestVersion });
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
}
