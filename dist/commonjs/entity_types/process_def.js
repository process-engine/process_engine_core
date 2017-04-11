"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_contracts_1 = require("@process-engine-js/core_contracts");
const data_model_contracts_1 = require("@process-engine-js/data_model_contracts");
const process_engine_contracts_1 = require("@process-engine-js/process_engine_contracts");
const metadata_1 = require("@process-engine-js/metadata");
const moment = require("moment");
const debug = require("debug");
const debugInfo = debug('processengine:info');
const debugErr = debug('processengine:error');
;
class ProcessDefEntity extends data_model_contracts_1.Entity {
    constructor(processDefEntityTypeService, processRepository, featureService, messageBusService, routingService, eventAggregator, timingService, entityDependencyHelper, context, schema) {
        super(entityDependencyHelper, context, schema);
        this._messageBusService = undefined;
        this._eventAggregator = undefined;
        this._timingService = undefined;
        this._processDefEntityTypeService = undefined;
        this._processRepository = undefined;
        this._featureService = undefined;
        this._routingService = undefined;
        this._processDefEntityTypeService = processDefEntityTypeService;
        this._processRepository = processRepository;
        this._featureService = featureService;
        this._messageBusService = messageBusService;
        this._routingService = routingService;
        this._eventAggregator = eventAggregator;
        this._timingService = timingService;
    }
    async initialize(derivedClassInstance) {
        const actualInstance = derivedClassInstance || this;
        await super.initialize(actualInstance);
    }
    get eventAggregator() {
        return this._eventAggregator;
    }
    get timingService() {
        return this._timingService;
    }
    get processDefEntityTypeService() {
        return this._processDefEntityTypeService;
    }
    get processRepository() {
        return this._processRepository;
    }
    get featureService() {
        return this._featureService;
    }
    get messageBusService() {
        return this._messageBusService;
    }
    get routingService() {
        return this._routingService;
    }
    get name() {
        return this.getProperty(this, 'name');
    }
    set name(value) {
        this.setProperty(this, 'name', value);
    }
    get key() {
        return this.getProperty(this, 'key');
    }
    set key(value) {
        this.setProperty(this, 'key', value);
    }
    get defId() {
        return this.getProperty(this, 'defId');
    }
    set defId(value) {
        this.setProperty(this, 'defId', value);
    }
    get xml() {
        return this.getProperty(this, 'xml');
    }
    set xml(value) {
        this.setProperty(this, 'xml', value);
    }
    get extensions() {
        return this.getProperty(this, 'extensions');
    }
    set extensions(value) {
        this.setProperty(this, 'extensions', value);
    }
    get internalName() {
        return this.getProperty(this, 'internalName');
    }
    set internalName(value) {
        this.setProperty(this, 'internalName', value);
    }
    get path() {
        return this.getProperty(this, 'path');
    }
    set path(value) {
        this.setProperty(this, 'path', value);
    }
    get category() {
        return this.getProperty(this, 'category');
    }
    set category(value) {
        this.setProperty(this, 'category', value);
    }
    get module() {
        return this.getProperty(this, 'module');
    }
    set module(value) {
        this.setProperty(this, 'module', value);
    }
    get readonly() {
        return this.getProperty(this, 'readonly');
    }
    set readonly(value) {
        this.setProperty(this, 'readonly', value);
    }
    get version() {
        return this.getProperty(this, 'version');
    }
    set version(value) {
        this.setProperty(this, 'version', value);
    }
    get counter() {
        return this.getProperty(this, 'counter');
    }
    set counter(value) {
        this.setProperty(this, 'counter', value);
    }
    get nodeDefCollection() {
        return this.getProperty(this, 'nodeDefCollection');
    }
    getNodeDefCollection(context) {
        return this.getPropertyLazy(this, 'nodeDefCollection', context);
    }
    get features() {
        return this._extractFeatures();
    }
    async start(context, params, options) {
        const processData = {
            key: this.key,
            processDef: this
        };
        const features = this.features;
        if (features === undefined || features.length === 0 || this.featureService.hasFeatures(features)) {
            debugInfo(`start process in same thread (key ${this.key}, features: ${JSON.stringify(features)})`);
            const processEntityType = await this.datastoreService.getEntityType('Process');
            const processEntity = (await processEntityType.createEntity(context, processData));
            await processEntity.save(context);
            await this.invoker.invoke(processEntity, 'start', undefined, context, context, params, options);
            const ref = processEntity.getEntityReference();
            return ref;
        }
        else {
            const appInstances = this.featureService.getApplicationIdsByFeatures(features);
            if (appInstances.length === 0) {
                debugErr(`can not start process key '${this.key}', features: ${JSON.stringify(features)}, no matching instance found`);
                throw new Error('can not start, no matching instance found');
            }
            const appInstanceId = appInstances[0];
            debugInfo(`start process on application '${appInstanceId}' (key '${this.key}', features: ${JSON.stringify(features)})`);
            const options = {
                action: 'POST',
                typeName: 'ProcessDef',
                method: 'start'
            };
            const message = this.messageBusService.createDatastoreMessage(options, context, params);
            try {
                const response = (await this.routingService.request(appInstanceId, message));
                const ref = new data_model_contracts_1.EntityReference(response.data.namespace, response.data.namespace, response.data.namespace);
                return ref;
            }
            catch (err) {
                debugErr(`can not start process on application '${appInstanceId}' (key '${this.key}', features: ${JSON.stringify(features)}), error: ${err.message}`);
            }
        }
    }
    async updateBpmn(context, params) {
        const xml = params && params.xml ? params.xml : null;
        if (xml) {
            this.xml = xml;
            this.counter = this.counter + 1;
            await this.updateDefinitions(context);
            if (this.internalName && this.path && !this.readonly) {
                await this.processRepository.saveProcess(this.internalName, this.xml);
            }
            return { result: true };
        }
    }
    _parseTimerDefinitionType(eventDefinition) {
        if (eventDefinition.timeDuration) {
            return process_engine_contracts_1.TimerDefinitionType.duration;
        }
        if (eventDefinition.timeCycle) {
            return process_engine_contracts_1.TimerDefinitionType.cycle;
        }
        if (eventDefinition.timeDate) {
            return process_engine_contracts_1.TimerDefinitionType.date;
        }
        return undefined;
    }
    _parseTimerDefinition(eventDefinition) {
        if (eventDefinition.timeDuration) {
            const input = eventDefinition.timeDuration.body;
            const duration = moment.duration(input);
            const date = moment().add(duration);
            return date;
        }
        if (eventDefinition.timeCycle) {
            const input = eventDefinition.timeCycle.body;
            const duration = moment.duration(input);
            const timingRule = {
                year: duration.years(),
                month: duration.months(),
                date: duration.days(),
                hour: duration.hours(),
                minute: duration.minutes(),
                second: duration.seconds()
            };
            return timingRule;
        }
        if (eventDefinition.timeDate) {
            const input = eventDefinition.timeDate.body;
            const date = moment(input);
            return date;
        }
        return undefined;
    }
    async startTimers(processes, context) {
        const processPromises = processes.map(async (process) => {
            const startEvents = process.flowElements.filter((element) => {
                return element.$type === 'bpmn:StartEvent';
            });
            if (startEvents.length === 0) {
                return;
            }
            const eventPromises = startEvents.map(async (startEvent) => {
                const definitionPromises = startEvent.eventDefinitions.map(async (eventDefinition) => {
                    if (eventDefinition.$type !== 'bpmn:TimerEventDefinition') {
                        return;
                    }
                    const timerDefinitionType = this._parseTimerDefinitionType(eventDefinition);
                    const timerDefinition = this._parseTimerDefinition(eventDefinition);
                    if (timerDefinitionType === undefined || timerDefinition === undefined) {
                        return;
                    }
                    await this._startTimer(timerDefinitionType, timerDefinition, async () => {
                        const data = {
                            action: 'start',
                            key: this.key,
                            token: undefined
                        };
                        const message = this.messageBusService.createEntityMessage(data, this, context);
                        await this.messageBusService.publish('/processengine', message);
                    }, context);
                });
                await Promise.all(definitionPromises);
            });
            await Promise.all(eventPromises);
        });
        await Promise.all(processPromises);
    }
    async _startTimer(timerDefinitionType, timerDefinition, callback, context) {
        const channelName = `events/timer/${this.id}`;
        switch (timerDefinitionType) {
            case process_engine_contracts_1.TimerDefinitionType.cycle:
                await this.timingService.periodic(timerDefinition, channelName, context);
                break;
            case process_engine_contracts_1.TimerDefinitionType.date:
                await this.timingService.once(timerDefinition, channelName, context);
                break;
            case process_engine_contracts_1.TimerDefinitionType.duration:
                await this.timingService.once(timerDefinition, channelName, context);
                break;
            default: return;
        }
        await this.eventAggregator.subscribeOnce(channelName, callback);
    }
    async updateDefinitions(context, params) {
        let bpmnDiagram = params && params.bpmnDiagram ? params.bpmnDiagram : null;
        const xml = this.xml;
        const key = this.key;
        const counter = this.counter;
        if (!bpmnDiagram) {
            bpmnDiagram = await this.processDefEntityTypeService.parseBpmnXml(xml);
        }
        const processes = bpmnDiagram.getProcesses();
        const currentProcess = processes.find((item) => item.id === key);
        if (currentProcess.extensionElements) {
            const extensions = this._updateExtensionElements(currentProcess.extensionElements.values);
            this.extensions = extensions;
        }
        this.version = currentProcess.$attrs ? currentProcess.$attrs['camunda:versionTag'] : '';
        await this.save(context);
        await this.startTimers(processes, context);
        const lanes = bpmnDiagram.getLanes(key);
        const laneCache = await this._updateLanes(lanes, context, counter);
        const nodes = bpmnDiagram.getNodes(key);
        const nodeCache = await this._updateNodes(nodes, laneCache, bpmnDiagram, context, counter);
        await this._createBoundaries(nodes, nodeCache, context);
        const flows = bpmnDiagram.getFlows(key);
        await this._updateFlows(flows, nodeCache, context, counter);
        const flowDefEntityType = await this.datastoreService.getEntityType('FlowDef');
        const queryObjectFlows = {
            operator: 'and',
            queries: [
                { attribute: 'counter', operator: '<', value: counter },
                { attribute: 'processDef', operator: '=', value: this.id }
            ]
        };
        const flowColl = await flowDefEntityType.query(context, { query: queryObjectFlows });
        await flowColl.each(context, async (flowEnt) => {
            await flowEnt.remove(context);
        });
        const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
        const queryObjectNodes = {
            operator: 'and',
            queries: [
                { attribute: 'counter', operator: '<', value: counter },
                { attribute: 'processDef', operator: '=', value: this.id }
            ]
        };
        const nodeColl = await nodeDefEntityType.query(context, { query: queryObjectNodes });
        await nodeColl.each(context, async (nodeEnt) => {
            await nodeEnt.remove(context);
        });
        const laneEntityType = await this.datastoreService.getEntityType('Lane');
        const queryObjectLanes = {
            operator: 'and',
            queries: [
                { attribute: 'counter', operator: '<', value: counter },
                { attribute: 'processDef', operator: '=', value: this.id }
            ]
        };
        const laneColl = await laneEntityType.query(context, { query: queryObjectLanes });
        await laneColl.each(context, async (laneEnt) => {
            await laneEnt.remove(context);
        });
    }
    async _updateLanes(lanes, context, counter) {
        const laneCache = {};
        const Lane = await this.datastoreService.getEntityType('Lane');
        const lanePromiseArray = lanes.map(async (lane) => {
            const queryObject = {
                operator: 'and',
                queries: [
                    { attribute: 'key', operator: '=', value: lane.id },
                    { attribute: 'processDef', operator: '=', value: this.id }
                ]
            };
            const queryOptions = {
                query: queryObject
            };
            let laneEntity = await Lane.findOne(context, queryOptions);
            if (!laneEntity) {
                laneEntity = await Lane.createEntity(context);
            }
            laneEntity.key = lane.id;
            laneEntity.name = lane.name;
            laneEntity.processDef = this;
            laneEntity.counter = counter;
            if (lane.extensionElements) {
                const extensions = this._updateExtensionElements(lane.extensionElements.values);
                laneEntity.extensions = extensions;
            }
            await laneEntity.save(context);
            laneCache[lane.id] = laneEntity;
        });
        await Promise.all(lanePromiseArray);
        return laneCache;
    }
    async _updateNodes(nodes, laneCache, bpmnDiagram, context, counter) {
        const nodeCache = {};
        const NodeDef = await this.datastoreService.getEntityType('NodeDef');
        const nodePromiseArray = nodes.map(async (node) => {
            const queryObject = {
                operator: 'and',
                queries: [
                    { attribute: 'key', operator: '=', value: node.id },
                    { attribute: 'processDef', operator: '=', value: this.id }
                ]
            };
            let nodeDefEntity = await NodeDef.findOne(context, { query: queryObject });
            if (!nodeDefEntity) {
                const nodeDefData = {
                    key: node.id
                };
                nodeDefEntity = await NodeDef.createEntity(context, nodeDefData);
            }
            switch (node.$type) {
                case 'bpmn:ScriptTask':
                    nodeDefEntity.script = node.script || null;
                    break;
                case 'bpmn:BoundaryEvent':
                    const eventType = (node.eventDefinitions && node.eventDefinitions.length > 0) ? node.eventDefinitions[0].$type : null;
                    if (eventType) {
                        nodeDefEntity.eventType = eventType;
                        nodeDefEntity.cancelActivity = node.cancelActivity || true;
                    }
                    break;
                case 'bpmn:CallActivity':
                    if (node.calledElement) {
                        nodeDefEntity.subProcessKey = node.calledElement;
                    }
                    break;
                case 'bpmn:SubProcess':
                    const subElements = node.flowElements ? node.flowElements : [];
                    const subNodes = subElements.filter((element) => element.$type !== 'bpmn:SequenceFlow');
                    const subFlows = subElements.filter((element) => element.$type === 'bpmn:SequenceFlow');
                    break;
                default:
            }
            if (node.extensionElements) {
                const extensions = this._updateExtensionElements(node.extensionElements.values);
                nodeDefEntity.extensions = extensions;
            }
            nodeDefEntity.name = node.name;
            nodeDefEntity.type = node.$type;
            nodeDefEntity.processDef = this;
            nodeDefEntity.counter = counter;
            const laneId = bpmnDiagram.getLaneOfElement(node.id);
            if (laneId) {
                nodeDefEntity.lane = laneCache[laneId];
            }
            await nodeDefEntity.save(context);
            nodeCache[node.id] = nodeDefEntity;
        });
        await Promise.all(nodePromiseArray);
        return nodeCache;
    }
    async _updateFlows(flows, nodeCache, context, counter) {
        const FlowDef = await this.datastoreService.getEntityType('FlowDef');
        const flowPromiseArray = flows.map(async (flow) => {
            const queryObject = {
                operator: 'and',
                queries: [
                    { attribute: 'key', operator: '=', value: flow.id },
                    { attribute: 'processDef', operator: '=', value: this.id }
                ]
            };
            let flowDefEntity = await FlowDef.findOne(context, { query: queryObject });
            if (!flowDefEntity) {
                const flowDefData = {
                    key: flow.id
                };
                flowDefEntity = await FlowDef.createEntity(context, flowDefData);
            }
            flowDefEntity.name = flow.name;
            flowDefEntity.processDef = this;
            flowDefEntity.counter = counter;
            if (flow.sourceRef && flow.sourceRef.id) {
                const sourceId = flow.sourceRef.id;
                flowDefEntity.source = nodeCache[sourceId];
            }
            if (flow.targetRef && flow.targetRef.id) {
                const targetId = flow.targetRef.id;
                flowDefEntity.target = nodeCache[targetId];
            }
            if (flow.conditionExpression && flow.conditionExpression.body) {
                flowDefEntity.condition = flow.conditionExpression.body;
            }
            await flowDefEntity.save(context);
        });
        await Promise.all(flowPromiseArray);
    }
    async _createBoundaries(nodes, nodeCache, context) {
        const nodePromiseArray = nodes.map(async (node) => {
            if (node.$type === 'bpmn:BoundaryEvent') {
                const attachedKey = (node.attachedToRef && node.attachedToRef.id) ? node.attachedToRef.id : null;
                if (attachedKey) {
                    const sourceEnt = nodeCache[attachedKey];
                    const boundary = nodeCache[node.id];
                    boundary.attachedToNode = sourceEnt;
                    await boundary.save(context);
                    const events = sourceEnt.events || {};
                    switch (boundary.eventType) {
                        case 'bpmn:ErrorEventDefinition':
                            events.error = boundary.key;
                            break;
                        default:
                    }
                    sourceEnt.events = events;
                    await sourceEnt.save(context);
                }
            }
        });
        await Promise.all(nodePromiseArray);
    }
    _updateExtensionElements(extensionElements) {
        const ext = {};
        extensionElements.forEach((extensionElement) => {
            if (extensionElement.$type === 'camunda:formData') {
                const formFields = [];
                if (extensionElement.$children) {
                    extensionElement.$children.forEach((child) => {
                        const formValues = [];
                        const formProperties = [];
                        if (child.$children) {
                            child.$children.forEach((formValue) => {
                                const childType = formValue.$type;
                                switch (childType) {
                                    case 'camunda:properties':
                                        if (formValue.$children) {
                                            formValue.$children.forEach((child) => {
                                                const newChild = {
                                                    $type: child.$type,
                                                    name: child.id,
                                                    value: child.value
                                                };
                                                formProperties.push(newChild);
                                            });
                                        }
                                        break;
                                    case 'camunda:value':
                                        const newFormValue = {
                                            $type: formValue.$type,
                                            id: formValue.id,
                                            name: formValue.name
                                        };
                                        formValues.push(newFormValue);
                                        break;
                                    default:
                                        break;
                                }
                            });
                        }
                        const newChild = {
                            $type: child.$type,
                            id: child.id,
                            label: child.label,
                            type: child.type,
                            defaultValue: child.defaultValue,
                            formValues: formValues,
                            formProperties: formProperties
                        };
                        formFields.push(newChild);
                    });
                }
                ext.formFields = formFields;
            }
            else if (extensionElement.$type === 'camunda:properties') {
                const properties = [];
                if (extensionElement.$children) {
                    extensionElement.$children.forEach((child) => {
                        const newChild = {
                            $type: child.$type,
                            name: child.name,
                            value: child.value
                        };
                        properties.push(newChild);
                    });
                }
                ext.properties = properties;
            }
        });
        return ext;
    }
    _extractFeatures() {
        let features = undefined;
        const extensions = this.extensions || null;
        const props = (extensions && extensions.properties) ? extensions.properties : null;
        if (props) {
            props.forEach((prop) => {
                if (prop.name === 'features') {
                    features = JSON.parse(prop.value);
                }
            });
        }
        return features;
    }
}
__decorate([
    metadata_1.schemaAttribute({
        type: core_contracts_1.SchemaAttributeType.string
    })
], ProcessDefEntity.prototype, "name", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessDefEntity.prototype, "key", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessDefEntity.prototype, "defId", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessDefEntity.prototype, "xml", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.object })
], ProcessDefEntity.prototype, "extensions", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessDefEntity.prototype, "internalName", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessDefEntity.prototype, "path", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessDefEntity.prototype, "category", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessDefEntity.prototype, "module", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.boolean })
], ProcessDefEntity.prototype, "readonly", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], ProcessDefEntity.prototype, "version", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.number })
], ProcessDefEntity.prototype, "counter", null);
__decorate([
    metadata_1.schemaAttribute({ type: 'NodeDef', isList: true, relatedAttribute: 'processDef' })
], ProcessDefEntity.prototype, "nodeDefCollection", null);
exports.ProcessDefEntity = ProcessDefEntity;

//# sourceMappingURL=process_def.js.map
