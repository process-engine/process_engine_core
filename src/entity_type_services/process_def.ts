import {IProcessDefEntityTypeService, IProcessDefEntity, BpmnDiagram, IParamImportFromFile, IParamImportFromXml, IParamStart, IProcessEntity} from '@process-engine-js/process_engine_contracts';
import {ExecutionContext, IPublicGetOptions, IQueryClause, IPrivateQueryOptions} from '@process-engine-js/core_contracts';
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

  public async importBpmnFromFile(context: ExecutionContext, params: IParamImportFromFile, options?: IPublicGetOptions): Promise<any> {

    const fileName = params && params.file ? params.file : null;
    if (fileName) {
      const path = process.cwd() + '/examples/bpmns/' + fileName;

      const xmlString = await this._getFile(path);

      await this.importBpmnFromXml(context, { xml: xmlString }, options);
      return { result: true };

    }

    throw new Error('file does not exist');
  }


  private async _getFile(path: string): Promise<string> {
    return new BluebirdPromise<any>((resolve, reject) => {
      fs.readFile(path, 'utf8', (error, xmlString) => {
        if (error) {
          reject(error);
        } else {
          resolve(xmlString);
        }
      });
    });
  }


  public async importBpmnFromXml(context: ExecutionContext, params: IParamImportFromXml, options?: IPublicGetOptions): Promise<void> {

    const xml = params && params.xml ? params.xml : null;

    if (xml) {
      const bpmnDiagram = await this.parseBpmnXml(xml);

      const ProcessDef = await this.datastoreService.getEntityType<IProcessDefEntity>('ProcessDef');

      const processes = bpmnDiagram.getProcesses();

      for (let i = 0; i < processes.length; i++) {
        const process = processes[i];

        // query with key
        const queryObject: IQueryClause = {
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

        await this.invoker.invoke(processDefEntity, 'updateDefinitions', undefined, context, context, { bpmnDiagram: bpmnDiagram });
      }
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


  public async start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<IProcessEntity> {

    const key: string = params ? params.key : undefined;

    if (key) {
      const ProcessDef = await this.datastoreService.getEntityType<IProcessDefEntity>('ProcessDef');

      const queryObject: IQueryClause = {
        attribute: 'key', operator: '=', value: key
      };
      const queryParams: IPrivateQueryOptions = { query: queryObject };
      const processDefEntity = await ProcessDef.findOne(context, queryParams);

      if (processDefEntity) {
        const processEntity: IProcessEntity = await this.invoker.invoke(processDefEntity, 'start', undefined, context, context, params, options);
        return processEntity;
      }
    }
    return null;
  }

  public async createProcess(context, token): Promise<any> {
    const name = token.history.ut_SetData.formData.name;
    const key = token.history.ut_SetData.formData.key.trim().replace(/\s/g, '_');
    const defId = 'Definition_1';

    const data = {
      name,
      key,
      defId,
      xml:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="' + defId + '" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Camunda Modeler" exporterVersion="1.7.2">' +
          '<bpmn:collaboration id="Collaboration_0ge6yss">' +
          '<bpmn:participant id="Participant_03ad0kv" name="' + name + '" processRef="' + key + '" />' +
          '</bpmn:collaboration>' +
        '<bpmn:process id="' + key + '" name="' + name + '" isExecutable="false">' +
          '<bpmn:laneSet>' +
        '<bpmn:lane id="Lane_0g5v1sg">' +
          '<bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>' +
        '</bpmn:lane>' +
        '</bpmn:laneSet>' +
        '<bpmn:startEvent id="StartEvent_1" name="' + name + '" />' +
          '</bpmn:process>' +
        '<bpmndi:BPMNDiagram id="BPMNDiagram_1">' +
          '<bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_0ge6yss">' +
          '<bpmndi:BPMNShape id="Participant_03ad0kv_di" bpmnElement="Participant_03ad0kv">' +
          '<dc:Bounds x="151" y="116" width="606" height="190" />' +
          '</bpmndi:BPMNShape>' +
        '<bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">' +
          '<dc:Bounds x="231" y="191" width="36" height="36" />' +
          '<bpmndi:BPMNLabel>' +
        '<dc:Bounds x="235" y="227" width="29" height="13" />' +
          '</bpmndi:BPMNLabel>' +
        '</bpmndi:BPMNShape>' +
        '<bpmndi:BPMNShape id="Lane_0g5v1sg_di" bpmnElement="Lane_0g5v1sg">' +
          '<dc:Bounds x="181" y="116" width="576" height="190" />' +
          '</bpmndi:BPMNShape>' +
        '</bpmndi:BPMNPlane>' +
        '</bpmndi:BPMNDiagram>' +
        '</bpmn:definitions>'
    };

    const createOptions = {};

    const processDefEntityType = await this.datastoreService.getEntityType('ProcessDef');
    const processDefEntity = await processDefEntityType.createEntity(context, data, createOptions);

    const saveOptions = {};
    await processDefEntity.save(context, saveOptions);

    const toPojoOptions = {};
    const pojo = await processDefEntity.toPojo(context, toPojoOptions);
    return pojo;
  }

}
