"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const process_engine_contracts_1 = require("@process-engine-js/process_engine_contracts");
const fs = require("fs");
const path = require("path");
const BluebirdPromise = require("bluebird");
const BpmnModdle = require("bpmn-moddle");
class ProcessDefEntityTypeService {
    constructor(datastoreServiceFactory, invoker) {
        this._datastoreService = undefined;
        this._datastoreServiceFactory = undefined;
        this._invoker = undefined;
        this._datastoreServiceFactory = datastoreServiceFactory;
        this._invoker = invoker;
    }
    get datastoreService() {
        if (!this._datastoreService) {
            this._datastoreService = this._datastoreServiceFactory();
        }
        return this._datastoreService;
    }
    get invoker() {
        return this._invoker;
    }
    async importBpmnFromFile(context, params, options) {
        const pathString = params && params.file ? params.file : null;
        if (pathString) {
            const xmlString = await this._getFile(pathString);
            const name = path.basename(pathString);
            await this.importBpmnFromXml(context, {
                xml: xmlString,
                path: pathString,
                internalName: name
            }, options);
            return { result: true };
        }
        throw new Error('file does not exist');
    }
    async _getFile(path) {
        return new BluebirdPromise((resolve, reject) => {
            fs.readFile(path, 'utf8', (error, xmlString) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(xmlString);
                }
            });
        });
    }
    async importBpmnFromXml(context, params, options) {
        const overwriteExisting = options && options.hasOwnProperty('overwriteExisting') ? options.overwriteExisting : true;
        const xml = params && params.xml ? params.xml : null;
        const internalName = params && params.internalName ? params.internalName : null;
        const pathString = params && params.path ? params.path : null;
        const category = params && params.category ? params.category : null;
        const module = params && params.module ? params.module : null;
        const readonly = params && params.readonly ? params.readonly : null;
        if (xml) {
            const bpmnDiagram = await this.parseBpmnXml(xml);
            const ProcessDef = await this.datastoreService.getEntityType('ProcessDef');
            const processes = bpmnDiagram.getProcesses();
            for (let i = 0; i < processes.length; i++) {
                const process = processes[i];
                const queryObject = {
                    attribute: 'key',
                    operator: '=',
                    value: process.id
                };
                const params = { query: queryObject };
                const processDefColl = await ProcessDef.query(context, params);
                let processDefEntity = processDefColl && processDefColl.length > 0 ? processDefColl.data[0] : null;
                let canSave = false;
                if (!processDefEntity) {
                    const processDefData = {
                        key: process.id,
                        defId: bpmnDiagram.definitions.id,
                        counter: 0
                    };
                    processDefEntity = await ProcessDef.createEntity(context, processDefData);
                    canSave = true;
                }
                else {
                    canSave = overwriteExisting;
                }
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
            }
        }
    }
    parseBpmnXml(xml) {
        const moddle = BpmnModdle();
        return new BluebirdPromise((resolve, reject) => {
            moddle.fromXML(xml, (error, definitions) => {
                if (error) {
                    reject(error);
                }
                else {
                    const bpmnDiagram = new process_engine_contracts_1.BpmnDiagram(definitions);
                    resolve(bpmnDiagram);
                }
            });
        });
    }
    parseBpmnFile(path) {
        return new BluebirdPromise((resolve, reject) => {
            fs.readFile(path, 'utf8', async (error, xmlString) => {
                if (error) {
                    reject(error);
                }
                else {
                    const definitions = await this.parseBpmnXml(xmlString);
                    const bpmnDiagram = new process_engine_contracts_1.BpmnDiagram(definitions);
                    resolve(bpmnDiagram);
                }
            });
        });
    }
    async start(context, params, options) {
        const key = params ? params.key : undefined;
        if (key) {
            const ProcessDef = await this.datastoreService.getEntityType('ProcessDef');
            const queryObject = {
                attribute: 'key', operator: '=', value: key
            };
            const queryParams = { query: queryObject };
            const processDefEntity = await ProcessDef.findOne(context, queryParams);
            if (processDefEntity) {
                const processEntity = await this.invoker.invoke(processDefEntity, 'start', undefined, context, context, params, options);
                return processEntity;
            }
        }
        return null;
    }
    async createProcess(context, token) {
        const name = token.history.ut_SetData.formData.name;
        const key = token.history.ut_SetData.formData.key.trim().replace(/\s/g, '_');
        const defId = 'Definition_1';
        const data = {
            name,
            key,
            defId,
            counter: 0,
            xml: '<?xml version="1.0" encoding="UTF-8"?>' +
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
exports.ProcessDefEntityTypeService = ProcessDefEntityTypeService;

//# sourceMappingURL=process_def.js.map
