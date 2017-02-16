import {IProcessDefEntityTypeService, IProcessDefEntity, BpmnDiagram, IParamImportFromFile, IParamImportFromXml, IParamStart} from '@process-engine-js/process_engine_contracts';
import {ExecutionContext, IPublicGetOptions, IQueryObject, IPrivateQueryOptions} from '@process-engine-js/core_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {IDatastoreService} from '@process-engine-js/data_model_contracts';

import * as fs from 'fs';
import * as BluebirdPromise from 'bluebird';
import * as BpmnModdle from 'bpmn-moddle';

export class ProcessDefEntityTypeService implements IProcessDefEntityTypeService {

  private _datastoreService: IDatastoreService = undefined;
  private _invoker: IInvoker = undefined;

  constructor(datastoreService: IDatastoreService, invoker: IInvoker) {
    this._datastoreService = datastoreService;
    this._invoker = invoker;
  }

  private get datastoreService(): IDatastoreService {
    return this._datastoreService;
  }

  private get invoker(): IInvoker {
    return this._invoker;
  }

  public importBpmnFromFile(context: ExecutionContext, params: IParamImportFromFile, options?: IPublicGetOptions): Promise<any> {

    const self = this;
    const fileName = params && params.file ? params.file : null;
    if (fileName) {
      const path = process.cwd() + '/examples/bpmns/' + fileName;

      return new BluebirdPromise<any>((resolve, reject) => {

        fs.readFile(path, 'utf8', async (error, xmlString) => {
          if (error) {
            reject(error);
          } else {

            return self.importBpmnFromXml(context, { xml: xmlString }, options);
          }
        });
      })
      .then(() => {
        return { result: true };
      });

    }
    return BluebirdPromise.reject(new Error('file does not exist'));
  }

  public async importBpmnFromXml(context: ExecutionContext, params: IParamImportFromXml, options?: IPublicGetOptions): Promise<void> {

    const xml = params && params.xml ? params.xml : null;

    if (xml) {
      const bpmnDiagram = await this.parseBpmnXml(xml);

      const ProcessDef = await this.datastoreService.getEntityType<IProcessDefEntity>('ProcessDef');

      const processes = bpmnDiagram.getProcesses();

      processes.forEach(async (process) => {

        // query with key
        const queryObject: IQueryObject = {
          attribute: 'key',
          operator: '=',
          value: process.id
        };
        const params: IPrivateQueryOptions = { query: queryObject };
        const processDefColl = await ProcessDef.query(context, params);

        let processDefEntity = processDefColl && processDefColl.length > 0 ? <IProcessDefEntity>processDefColl.data[0] : null;
        if (!processDefEntity) {
          
          const processDefData = {
            key: process.id,
            defId: bpmnDiagram.definitions.id
          };

          processDefEntity = await ProcessDef.createEntity<IProcessDefEntity>(context, processDefData);
        }

        processDefEntity.name = process.name;
        processDefEntity.xml = xml;

        await processDefEntity.save(context);

        await this.invoker.invoke(processDefEntity, 'updateDefinitions', context, context, { bpmnDiagram: bpmnDiagram });
      
      });
    }
  }

  public parseBpmnXml(xml: string): Promise<BpmnDiagram> {

    const moddle = BpmnModdle();

    return new BluebirdPromise<BpmnDiagram>((resolve, reject) => {

      moddle.fromXML(xml, (error, definitions) => {
        if (error) {
          reject(error);
        } else {

          const bpmnDiagram = new BpmnDiagram(definitions);
          resolve(bpmnDiagram);
        }
      });
    });
  }

  public parseBpmnFile(path: string): Promise<BpmnDiagram> {

    return new BluebirdPromise<BpmnDiagram>((resolve, reject) => {

      fs.readFile(path, 'utf8', async (error, xmlString) => {
        if (error) {
          reject(error);
        } else {

          const definitions = await this.parseBpmnXml(xmlString);

          const bpmnDiagram = new BpmnDiagram(definitions);
          resolve(bpmnDiagram);
        }
      });
    });
  }


  public async start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<string> {

    const key: string = params ? params.key : undefined;

    if (key) {
      const ProcessDef = await this.datastoreService.getEntityType<IProcessDefEntity>('ProcessDef');

      const queryObject: IQueryObject = {
        attribute: 'key',
        operator: '=',
        value: key
      };
      const queryParams: IPrivateQueryOptions = { query: queryObject };
      const processDefEntity = await ProcessDef.findOne(context, queryParams);

      if (processDefEntity) {
        const id = await this.invoker.invoke(processDefEntity, 'start', context, context, params, options);
        return id;
      }
    }
    return null;
  }

}
