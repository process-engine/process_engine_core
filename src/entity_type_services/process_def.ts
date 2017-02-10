import {IProcessDefEntityTypeService, IProcessDefEntity, BpmnDiagram} from '@process-engine-js/process_engine_contracts';
import {IDataModel, IEntityType} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, IPublicGetOptions} from '@process-engine-js/core_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';

import * as fs from 'fs';
import * as BluebirdPromise from 'bluebird';

// Todo: write declaration file for bpmn-moddle
// let BpmnModdle: any;
// tslint:disable-next-line
// BpmnModdle = require('bpmn-moddle');

import * as BpmnModdle from 'bpmn-moddle';


export class ProcessDefEntityTypeService implements IProcessDefEntityTypeService {

  private _dataModel: IDataModel = undefined;
  private _invoker: IInvoker = undefined;

  constructor(dataModel: IDataModel, invoker: IInvoker) {
    this._dataModel = dataModel;
    this._invoker = invoker;
  }

  private get dataModel(): IDataModel {
    return this._dataModel;
  }

  private get invoker(): IInvoker {
    return this._invoker;
  }

  public async importBpmnFromFile(context: ExecutionContext, param: any, options?: IPublicGetOptions): Promise<void> {

    const self = this;
    const fileName = param && param.file ? param.file : null;
    if (fileName) {
      const path = process.cwd() + '/examples/bpmns/' + fileName;

      return new BluebirdPromise<BpmnDiagram>((resolve, reject) => {

      fs.readFile(path, 'utf8', async (error, xmlString) => {
        if (error) {
          reject(error);
        } else {

          return self.importBpmnFromXml(context, { xml: xmlString }, options);
        }
      });
    });

    }

  }

  public async importBpmnFromXml(context: ExecutionContext, param: any, options?: IPublicGetOptions): Promise<void> {

    const xml = param && param.xml ? param.xml : null;

    if (xml) {
      const typeName = 'ProcessDef';
      const bpmnDiagram = await this.parseBpmnXml(xml);

      const processDefEntityType = await this.dataModel.getEntityType<IProcessDefEntity>(undefined, typeName);

      const processes = bpmnDiagram.getProcesses();

      processes.forEach(async (process) => {

        let processDefEntity = await processDefEntityType.getById(process.id, context);

        if (!processDefEntity) {
          
          const processDefData = {
            key: process.id,
            defId: bpmnDiagram.definitions.id
          };

          processDefEntity = await processDefEntityType.createEntity<IProcessDefEntity>(context, processDefData);
        }

        processDefEntity.name = process.name;
        processDefEntity.xml = xml;

        await processDefEntity.save(context);

        await this.invoker.invoke(processDefEntity, 'updateDefinitions', context);
      
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

}