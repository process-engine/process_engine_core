"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bpmn_diagram_1 = require("../bpmn_diagram");
const BluebirdPromise = require("bluebird");
const BpmnModdle = require("bpmn-moddle");
class ProcessDefEntityTypeService {
    constructor(datastoreServiceFactory, processRepository, invoker) {
        this._datastoreService = undefined;
        this._processRepository = undefined;
        this._invoker = undefined;
        this._datastoreService = datastoreServiceFactory;
        this._processRepository = processRepository;
        this._invoker = invoker;
    }
    get datastoreService() {
        return this._datastoreService;
    }
    get invoker() {
        return this._invoker;
    }
    get processRepository() {
        return this._processRepository;
    }
    async importBpmnFromFile(context, params, options) {
        const pathString = params && params.file ? params.file : null;
        if (pathString) {
            const xmlString = await this.processRepository.getXmlFromFile(pathString);
            const name = pathString.split('/').pop();
            await this.importBpmnFromXml(context, {
                xml: xmlString,
                path: pathString,
                internalName: name
            }, options);
            return { result: true };
        }
        throw new Error('file does not exist');
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
            const processDef = await this.datastoreService.getEntityType('ProcessDef');
            const processes = bpmnDiagram.getProcesses();
            for (let i = 0; i < processes.length; i++) {
                const process = processes[i];
                const queryObject = {
                    attribute: 'key',
                    operator: '=',
                    value: process.id
                };
                const queryParams = { query: queryObject };
                const processDefColl = await processDef.query(context, queryParams);
                let processDefEntity = processDefColl && processDefColl.length > 0 ? processDefColl.data[0] : null;
                let canSave = false;
                if (!processDefEntity) {
                    const processDefData = {
                        key: process.id,
                        defId: bpmnDiagram.definitions.id,
                        counter: 0
                    };
                    processDefEntity = await processDef.createEntity(context, processDefData);
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
        return (new BluebirdPromise((resolve, reject) => {
            moddle.fromXML(xml, (error, definitions) => {
                if (error) {
                    reject(error);
                }
                else {
                    const bpmnDiagram = new bpmn_diagram_1.BpmnDiagram(definitions);
                    resolve(bpmnDiagram);
                }
            });
        }));
    }
    async start(context, params, options) {
        const key = params ? params.key : undefined;
        if (key) {
            const processDef = await this.datastoreService.getEntityType('ProcessDef');
            const queryObject = {
                attribute: 'key', operator: '=', value: key
            };
            const queryParams = { query: queryObject };
            const processDefEntity = await processDef.findOne(context, queryParams);
            if (processDefEntity) {
                const processEntityRef = await this.invoker.invoke(processDefEntity, 'start', undefined, context, context, params, options);
                return processEntityRef;
            }
        }
        return null;
    }
}
exports.ProcessDefEntityTypeService = ProcessDefEntityTypeService;

//# sourceMappingURL=process_def.js.map
