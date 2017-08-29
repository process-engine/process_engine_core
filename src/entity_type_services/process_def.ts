import {
  IProcessDefEntityTypeService, IProcessDefEntity, IParamImportFromFile,
  IParamImportFromXml, IParamStart, IImportFromFileOptions,
  IProcessRepository, IImportFromXmlOptions
} from '@process-engine-js/process_engine_contracts';
import { ExecutionContext, IPublicGetOptions, IQueryClause, IPrivateQueryOptions, IEntityReference } from '@process-engine-js/core_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IDatastoreService } from '@process-engine-js/data_model_contracts';
import { BpmnDiagram } from '../bpmn_diagram';

import * as BluebirdPromise from 'bluebird';
import * as BpmnModdle from 'bpmn-moddle';

export class ProcessDefEntityTypeService implements IProcessDefEntityTypeService {

  private _datastoreService: IDatastoreService = undefined;
  private _processRepository: IProcessRepository = undefined;
  private _invoker: IInvoker = undefined;

  constructor(datastoreServiceFactory: IDatastoreService, processRepository: IProcessRepository, invoker: IInvoker) {
    this._datastoreService = datastoreServiceFactory;
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
          internalName: name
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

    if (xml) {
      console.log('ProcessDefService - Import from xml 1')
      const bpmnDiagram = await this.parseBpmnXml(xml);

      console.log('ProcessDefService - Import from xml 2')
      const processDef = await this.datastoreService.getEntityType<IProcessDefEntity>('ProcessDef');
      console.log('ProcessDefService - Import from xml 3', typeof processDef);

      const processes = bpmnDiagram.getProcesses();
      console.log('ProcessDefService - Import from xml 4')

      for (let i = 0; i < processes.length; i++) {
        const process = processes[i];

        // query with key
        const queryObject: IQueryClause = {
          attribute: 'key',
          operator: '=',
          value: process.id
        };
        const queryParams: IPrivateQueryOptions = { query: queryObject };
        console.log('ProcessDefService - Import from xml 5')
        const processDefColl = await processDef.query(context, queryParams);
        console.log('ProcessDefService - Import from xml 6')

        let processDefEntity = processDefColl && processDefColl.length > 0 ? <IProcessDefEntity>processDefColl.data[0] : null;

        let canSave = false;
        console.log('ProcessDefService - Import from xml 7')
        if (!processDefEntity) {

          const processDefData = {
            key: process.id,
            defId: bpmnDiagram.definitions.id,
            counter: 0
          };

          console.log('ProcessDefService - Import from xml 7.1')
          processDefEntity = await processDef.createEntity<IProcessDefEntity>(context, processDefData);
          console.log('ProcessDefService - Import from xml 7.2')

          // always create new processes
          canSave = true;
        } else {
          // check if we can overwrite existing processes
          canSave = overwriteExisting;
        }
        console.log('ProcessDefService - Import from xml 8')

        if (canSave) {
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
        console.log('ProcessDefService - Import from xml 9')
      }
    }
  }

  public parseBpmnXml(xml: string): Promise<BpmnDiagram> {

    const moddle = BpmnModdle();

    return <any>(new BluebirdPromise<BpmnDiagram>((resolve, reject) => {

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

    const key: string = params ? params.key : undefined;

    if (key) {
      const processDef = await this.datastoreService.getEntityType<IProcessDefEntity>('ProcessDef');

      const queryObject: IQueryClause = {
        attribute: 'key', operator: '=', value: key
      };
      const queryParams: IPrivateQueryOptions = { query: queryObject };
      const processDefEntity = await processDef.findOne(context, queryParams);

      if (processDefEntity) {
        const processEntityRef: IEntityReference = await this.invoker.invoke(processDefEntity, 'start', undefined, context, context, params, options);
        return processEntityRef;
      }
    }
    return null;
  }

}
