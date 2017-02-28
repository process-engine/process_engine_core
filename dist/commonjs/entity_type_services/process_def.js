"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
                fs.readFile(path, 'utf8', (error, xmlString) => __awaiter(this, void 0, void 0, function* () {
                    if (error) {
                        reject(error);
                    }
                    else {
                        return self.importBpmnFromXml(context, { xml: xmlString }, options);
                    }
                }));
            })
                .then(() => {
                return { result: true };
            });
        }
        return BluebirdPromise.reject(new Error('file does not exist'));
    }
    importBpmnFromXml(context, params, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const xml = params && params.xml ? params.xml : null;
            if (xml) {
                const bpmnDiagram = yield this.parseBpmnXml(xml);
                const ProcessDef = yield this.datastoreService.getEntityType('ProcessDef');
                const processes = bpmnDiagram.getProcesses();
                processes.forEach((process) => __awaiter(this, void 0, void 0, function* () {
                    const queryObject = {
                        attribute: 'key',
                        operator: '=',
                        value: process.id
                    };
                    const params = { query: queryObject };
                    const processDefColl = yield ProcessDef.query(context, params);
                    let processDefEntity = processDefColl && processDefColl.length > 0 ? processDefColl.data[0] : null;
                    if (!processDefEntity) {
                        const processDefData = {
                            key: process.id,
                            defId: bpmnDiagram.definitions.id
                        };
                        processDefEntity = yield ProcessDef.createEntity(context, processDefData);
                    }
                    processDefEntity.name = process.name;
                    processDefEntity.xml = xml;
                    yield processDefEntity.save(context);
                    yield this.invoker.invoke(processDefEntity, 'updateDefinitions', context, context, { bpmnDiagram: bpmnDiagram });
                }));
            }
        });
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
            fs.readFile(path, 'utf8', (error, xmlString) => __awaiter(this, void 0, void 0, function* () {
                if (error) {
                    reject(error);
                }
                else {
                    const definitions = yield this.parseBpmnXml(xmlString);
                    const bpmnDiagram = new process_engine_contracts_1.BpmnDiagram(definitions);
                    resolve(bpmnDiagram);
                }
            }));
        });
    }
    start(context, params, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = params ? params.key : undefined;
            if (key) {
                const ProcessDef = yield this.datastoreService.getEntityType('ProcessDef');
                const queryObject = {
                    attribute: 'key',
                    operator: '=',
                    value: key
                };
                const queryParams = { query: queryObject };
                const processDefEntity = yield ProcessDef.findOne(context, queryParams);
                if (processDefEntity) {
                    const processEntity = yield this.invoker.invoke(processDefEntity, 'start', context, context, params, options);
                    return processEntity;
                }
            }
            return null;
        });
    }
}
exports.ProcessDefEntityTypeService = ProcessDefEntityTypeService;

//# sourceMappingURL=process_def.js.map
