"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const process_engine_contracts_1 = require("@process-engine-js/process_engine_contracts");
const fs = require("fs");
const BluebirdPromise = require("bluebird");
const BpmnModdle = require("bpmn-moddle");
class ProcessDefEntityTypeService {
    constructor(datastoreService, invoker) {
        this._datastoreService = undefined;
        this._invoker = undefined;
        this._datastoreService = datastoreService;
        this._invoker = invoker;
    }
    get datastoreService() {
        return this._datastoreService;
    }
    get invoker() {
        return this._invoker;
    }
    importBpmnFromFile(context, params, options) {
        const self = this;
        const fileName = params && params.file ? params.file : null;
        if (fileName) {
            const path = process.cwd() + '/examples/bpmns/' + fileName;
            return new BluebirdPromise((resolve, reject) => {
                fs.readFile(path, 'utf8', async (error, xmlString) => {
                    if (error) {
                        reject(error);
                    }
                    else {
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
    async importBpmnFromXml(context, params, options) {
        const xml = params && params.xml ? params.xml : null;
        if (xml) {
            const bpmnDiagram = await this.parseBpmnXml(xml);
            const ProcessDef = await this.datastoreService.getEntityType('ProcessDef');
            const processes = bpmnDiagram.getProcesses();
            processes.forEach(async (process) => {
                const queryObject = {
                    attribute: 'key',
                    operator: '=',
                    value: process.id
                };
                const params = { query: queryObject };
                const processDefColl = await ProcessDef.query(context, params);
                let processDefEntity = processDefColl && processDefColl.length > 0 ? processDefColl.data[0] : null;
                if (!processDefEntity) {
                    const processDefData = {
                        key: process.id,
                        defId: bpmnDiagram.definitions.id
                    };
                    processDefEntity = await ProcessDef.createEntity(context, processDefData);
                }
                processDefEntity.name = process.name;
                processDefEntity.xml = xml;
                await processDefEntity.save(context);
                await this.invoker.invoke(processDefEntity, 'updateDefinitions', context, context, { bpmnDiagram: bpmnDiagram });
            });
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
                const processEntity = await this.invoker.invoke(processDefEntity, 'start', context, context, params, options);
                return processEntity;
            }
        }
        return null;
    }
}
exports.ProcessDefEntityTypeService = ProcessDefEntityTypeService;

//# sourceMappingURL=process_def.js.map
