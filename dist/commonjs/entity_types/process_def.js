"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const core_contracts_1 = require("@process-engine-js/core_contracts");
const data_model_contracts_1 = require("@process-engine-js/data_model_contracts");
const metadata_1 = require("@process-engine-js/metadata");
;
class ProcessDefEntity extends data_model_contracts_1.Entity {
    constructor(processDefEntityTypeService, entityDependencyHelper, context, schema) {
        super(entityDependencyHelper, context, schema);
        this._processDefEntityTypeService = undefined;
        this._processDefEntityTypeService = processDefEntityTypeService;
    }
    async initialize(derivedClassInstance) {
        const actualInstance = derivedClassInstance || this;
        await super.initialize(actualInstance);
    }
    get processDefEntityTypeService() {
        return this._processDefEntityTypeService;
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
    get nodeDefCollection() {
        return this.getProperty(this, 'nodeDefCollection');
    }
    getNodeDefCollection(context) {
        return this.getPropertyLazy(this, 'nodeDefCollection', context);
    }
    async start(context, params, options) {
        const processData = {
            key: this.key,
            processDef: this
        };
        const processEntityType = await this.datastoreService.getEntityType('Process');
        const processEntity = (await processEntityType.createEntity(context, processData));
        await processEntity.save(context);
        await this.invoker.invoke(processEntity, 'start', context, context, params, options);
        return processEntity;
    }
    async updateBpmn(context, params) {
        const xml = params && params.xml ? params.xml : null;
        if (xml) {
            this.xml = xml;
            await this.save(context);
            await this.updateDefinitions(context);
            return { result: true };
        }
    }
    async updateDefinitions(context, params) {
        let bpmnDiagram = params && params.bpmnDiagram ? params.bpmnDiagram : null;
        const xml = this.xml;
        const key = this.key;
        if (!bpmnDiagram) {
            bpmnDiagram = await this.processDefEntityTypeService.parseBpmnXml(xml);
        }
        const lanes = bpmnDiagram.getLanes(key);
        const laneCache = await this._updateLanes(lanes, context);
        const nodes = bpmnDiagram.getNodes(key);
        const nodeCache = await this._updateNodes(nodes, laneCache, bpmnDiagram, context);
        await this._createBoundaries(nodes, nodeCache, context);
        const flows = bpmnDiagram.getFlows(key);
        await this._updateFlows(flows, nodeCache, context);
    }
    async _updateLanes(lanes, context) {
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
                const laneData = {
                    key: lane.id
                };
                laneEntity = await Lane.createEntity(context, laneData);
            }
            laneEntity.name = lane.name;
            laneEntity.processDef = this;
            await laneEntity.save(context);
            laneCache[lane.id] = laneEntity;
        });
        await Promise.all(lanePromiseArray);
        return laneCache;
    }
    async _updateNodes(nodes, laneCache, bpmnDiagram, context) {
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
    async _updateFlows(flows, nodeCache, context) {
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
                extensionElement.$children.forEach((child) => {
                    const formValues = [];
                    const formProperties = [];
                    child.$children.forEach((formValue) => {
                        const childType = formValue.$type;
                        switch (childType) {
                            case 'camunda:properties':
                                formValue.$children.forEach((child) => {
                                    const newChild = {
                                        $type: child.$type,
                                        name: child.id,
                                        value: child.value
                                    };
                                    formProperties.push(newChild);
                                });
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
                ext.formFields = formFields;
            }
            else if (extensionElement.$type === 'camunda:properties') {
                const properties = [];
                extensionElement.$children.forEach((child) => {
                    const newChild = {
                        $type: child.$type,
                        name: child.name,
                        value: child.value
                    };
                    properties.push(newChild);
                });
                ext.properties = properties;
            }
        });
        return ext;
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
    metadata_1.schemaAttribute({ type: 'NodeDef', isList: true, relatedAttribute: 'processDef' })
], ProcessDefEntity.prototype, "nodeDefCollection", null);
exports.ProcessDefEntity = ProcessDefEntity;

//# sourceMappingURL=process_def.js.map
