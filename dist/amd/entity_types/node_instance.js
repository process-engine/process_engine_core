var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
define(["require", "exports", "@process-engine-js/core_contracts", "@process-engine-js/data_model_contracts", "@process-engine-js/metadata", "debug"], function (require, exports, core_contracts_1, data_model_contracts_1, metadata_1, debug) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const debugInfo = debug('processengine:info');
    const debugErr = debug('processengine:error');
    class NodeInstanceEntityDependencyHelper {
        constructor(messageBusService, eventAggregator, iamService, nodeInstanceEntityTypeService, processEngineService, timingService) {
            this.messageBusService = undefined;
            this.eventAggregator = undefined;
            this.iamService = undefined;
            this.nodeInstanceEntityTypeService = undefined;
            this.processEngineService = undefined;
            this.timingService = undefined;
            this.messageBusService = messageBusService;
            this.eventAggregator = eventAggregator;
            this.iamService = iamService;
            this.nodeInstanceEntityTypeService = nodeInstanceEntityTypeService;
            this.processEngineService = processEngineService;
            this.timingService = timingService;
        }
    }
    exports.NodeInstanceEntityDependencyHelper = NodeInstanceEntityDependencyHelper;
    let NodeInstanceEntity = class NodeInstanceEntity extends data_model_contracts_1.Entity {
        constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema) {
            super(entityDependencyHelper, context, schema);
            this._nodeInstanceEntityDependencyHelper = undefined;
            this.messagebusSubscription = undefined;
            this.eventAggregatorSubscription = undefined;
            this._nodeInstanceEntityDependencyHelper = nodeInstanceEntityDependencyHelper;
        }
        get iamService() {
            return this._nodeInstanceEntityDependencyHelper.iamService;
        }
        get messageBusService() {
            return this._nodeInstanceEntityDependencyHelper.messageBusService;
        }
        get eventAggregator() {
            return this._nodeInstanceEntityDependencyHelper.eventAggregator;
        }
        get nodeInstanceEntityTypeService() {
            return this._nodeInstanceEntityDependencyHelper.nodeInstanceEntityTypeService;
        }
        get processEngineService() {
            return this._nodeInstanceEntityDependencyHelper.processEngineService;
        }
        get timingService() {
            return this._nodeInstanceEntityDependencyHelper.timingService;
        }
        async initialize(derivedClassInstance) {
            const actualInstance = derivedClassInstance || this;
            await super.initialize(actualInstance);
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
        get process() {
            return this.getProperty(this, 'process');
        }
        set process(value) {
            this.setProperty(this, 'process', value);
        }
        getProcess(context) {
            return this.getPropertyLazy(this, 'process', context);
        }
        get nodeDef() {
            return this.getProperty(this, 'nodeDef');
        }
        set nodeDef(value) {
            this.setProperty(this, 'nodeDef', value);
        }
        getNodeDef(context) {
            return this.getPropertyLazy(this, 'nodeDef', context);
        }
        get type() {
            return this.getProperty(this, 'type');
        }
        set type(value) {
            this.setProperty(this, 'type', value);
        }
        get state() {
            return this.getProperty(this, 'state');
        }
        set state(value) {
            this.setProperty(this, 'state', value);
        }
        get participant() {
            return this.getProperty(this, 'participant');
        }
        set participant(value) {
            this.setProperty(this, 'participant', value);
        }
        get application() {
            return this.getProperty(this, 'application');
        }
        set application(value) {
            this.setProperty(this, 'application', value);
        }
        get processToken() {
            return this.getProperty(this, 'processToken');
        }
        set processToken(value) {
            this.setProperty(this, 'processToken', value);
        }
        getProcessToken(context) {
            return this.getPropertyLazy(this, 'processToken', context);
        }
        get instanceCounter() {
            return this.getProperty(this, 'instanceCounter');
        }
        set instanceCounter(value) {
            this.setProperty(this, 'instanceCounter', value);
        }
        async getLaneRole(context) {
            const nodeDef = this.nodeDef;
            const role = await nodeDef.getLaneRole(context);
            return role;
        }
        async start(context, source) {
            debugInfo(`start node, id ${this.id}, key ${this.key}, type ${this.type}`);
            let role = await this.nodeDef.lane.role;
            if (role !== null) {
            }
            if (!this.state) {
                this.state = 'start';
            }
            this.process.addActiveInstance(this);
            const internalContext = await this.iamService.createInternalContext('processengine_system');
            const processTokenEntityType = await this.datastoreService.getEntityType('ProcessToken');
            const processToken = this.processToken;
            const processDef = this.process.processDef;
            const currentToken = await processTokenEntityType.createEntity(internalContext);
            currentToken.process = processToken.process;
            currentToken.data = processToken.data;
            if (processDef.persist) {
                await currentToken.save(internalContext, { reloadAfterSave: false });
            }
            for (let i = 0; i < this.process.processDef.nodeDefCollection.data.length; i++) {
                const boundary = this.process.processDef.nodeDefCollection.data[i];
                if (boundary.attachedToNode && boundary.attachedToNode.id === this.nodeDef.id) {
                    await this.nodeInstanceEntityTypeService.createNextNode(context, this, boundary, currentToken);
                }
            }
            this.changeState(context, 'execute', this);
        }
        changeState(context, newState, source) {
            debugInfo(`change state of node, id ${this.id}, key ${this.key}, type ${this.type},  new state: ${newState}`);
            const data = {
                action: 'changeState',
                data: newState
            };
            const event = this.eventAggregator.createEntityEvent(data, source, context, (source && ('participant' in source) ? { participantId: source.participant } : null));
            this.eventAggregator.publish('/processengine/node/' + this.id, event);
        }
        error(context, error) {
            debugErr(`node error, id ${this.id}, key ${this.key}, type ${this.type}, ${error}`);
            this.triggerEvent(context, 'error', error);
        }
        async wait(context) {
            debugInfo(`execute node, id ${this.id}, key ${this.key}, type ${this.type}`);
            const internalContext = await this.iamService.createInternalContext('processengine_system');
            this.state = 'wait';
            if (this.process.processDef.persist) {
                await this.save(internalContext, { reloadAfterSave: false });
            }
        }
        async execute(context) {
            debugInfo(`execute node, id ${this.id}, key ${this.key}, type ${this.type}`);
            this.state = 'progress';
            this.changeState(context, 'end', this);
        }
        async proceed(context, data, source, applicationId, participant) {
        }
        triggerEvent(context, eventType, data) {
            const payload = {
                action: 'event',
                eventType: eventType,
                data: data
            };
            const entityEvent = this.eventAggregator.createEntityEvent(payload, this, context, (('participant' in this) ? { participantId: this.participant } : null));
            this.eventAggregator.publish('/processengine/node/' + this.id, entityEvent);
        }
        async _publishToApi(context, eventType, data) {
            const payload = {
                action: 'event',
                eventType: eventType,
                data: data
            };
            const msg = this.messageBusService.createEntityMessage(payload, this, context);
            await this.messageBusService.publish('/processengine_api/event/' + this.id, msg);
        }
        async event(context, eventType, data, source, applicationId, participant) {
            debugInfo(`node event, id ${this.id}, key ${this.key}, type ${this.type}, event ${eventType}`);
            const internalContext = await this.iamService.createInternalContext('processengine_system');
            const map = new Map();
            map.set('error', 'bpmn:ErrorEventDefinition');
            map.set('cancel', 'bpmn:CancelEventDefinition');
            map.set('data', 'bpmn:ConditionalEventDefinition');
            const bpmnType = map.get(eventType);
            const activeInstancesKeys = Object.keys(this.process.activeInstances);
            const boundaries = [];
            for (let i = 0; i < activeInstancesKeys.length; i++) {
                const boundaryEntity = this.process.activeInstances[activeInstancesKeys[i]];
                if (boundaryEntity.attachedToInstance && (boundaryEntity.attachedToInstance.id === this.id) && (boundaryEntity.nodeDef.eventType === bpmnType)) {
                    boundaries.push(boundaryEntity);
                }
            }
            if (boundaries.length > 0) {
                for (let i = 0; i < boundaries.length; i++) {
                    await this.boundaryEvent(context, boundaries[i], data, source, applicationId, participant);
                }
            }
            else {
                if (eventType === 'error' || eventType === 'cancel') {
                    if (eventType === 'error') {
                        data = { message: data.message };
                    }
                    await this._publishToApi(context, eventType, data);
                    await this.end(context);
                }
            }
        }
        triggerBoundaryEvent(context, eventEntity, data) {
            const payload = {
                action: 'boundary',
                eventEntity: eventEntity,
                data: data
            };
            const entityEvent = this.eventAggregator.createEntityEvent(payload, this, context, (('participant' in this) ? { participantId: this.participant } : null));
            this.eventAggregator.publish('/processengine/node/' + this.id, entityEvent);
        }
        async boundaryEvent(context, eventEntity, data, source, applicationId, participant) {
            debugInfo(`node boundary event, id ${this.id}, key ${this.key}, type ${this.type}, event ${eventEntity.type}`);
            const internalContext = await this.iamService.createInternalContext('processengine_system');
            const boundaryDef = eventEntity.nodeDef;
            const processToken = await this.processToken;
            const tokenData = processToken.data || {};
            if (boundaryDef) {
                switch (boundaryDef.eventType) {
                    case 'bpmn:ErrorEventDefinition':
                        const errCode = data.number || data.code || data.errorCode || undefined;
                        if ((boundaryDef.errorCode && errCode && boundaryDef.errorCode === errCode.toString()) || !boundaryDef.errorCode) {
                            const processToken = this.processToken;
                            const tokenData = processToken.data || {};
                            data = { message: data.message, errorCode: errCode };
                            tokenData.current = data;
                            processToken.data = tokenData;
                            await this._publishToApi(context, 'cancel', data);
                            eventEntity.changeState(context, 'end', this);
                            await this.end(context, true);
                        }
                        break;
                    case 'bpmn:TimerEventDefinition':
                        if (boundaryDef.cancelActivity) {
                            eventEntity.changeState(context, 'end', this);
                            this.cancel(internalContext);
                        }
                        else {
                            await this._publishToApi(context, 'timer', data);
                            eventEntity.changeState(context, 'follow', this);
                        }
                        break;
                    case 'bpmn:SignalEventDefinition':
                        if (boundaryDef.cancelActivity) {
                            const processToken = this.processToken;
                            const tokenData = processToken.data || {};
                            tokenData.current = data;
                            processToken.data = tokenData;
                            eventEntity.changeState(context, 'end', this);
                            this.cancel(context);
                        }
                        else {
                            const processTokenEntityType = await this.datastoreService.getEntityType('ProcessToken');
                            const newToken = await processTokenEntityType.createEntity(internalContext);
                            newToken.process = this.process;
                            const processToken = this.processToken;
                            const tokenData = processToken.data || {};
                            tokenData.current = data;
                            newToken.data = processToken.data;
                            this.processToken = newToken;
                            await this._publishToApi(context, 'signal', data);
                            eventEntity.changeState(context, 'follow', this);
                        }
                        break;
                    case 'bpmn:MessageEventDefinition':
                        if (boundaryDef.cancelActivity) {
                            const processToken = this.processToken;
                            const tokenData = processToken.data || {};
                            tokenData.current = data;
                            processToken.data = tokenData;
                            eventEntity.changeState(context, 'end', this);
                            this.cancel(context);
                        }
                        else {
                            const processTokenEntityType = await this.datastoreService.getEntityType('ProcessToken');
                            const newToken = await processTokenEntityType.createEntity(internalContext);
                            newToken.process = this.process;
                            const processToken = this.processToken;
                            const tokenData = processToken.data || {};
                            tokenData.current = data;
                            newToken.data = processToken.data;
                            this.processToken = newToken;
                            if (this.nodeDef.processDef.persist) {
                                await newToken.save(internalContext, { reloadAfterSave: false });
                            }
                            this.processToken = newToken;
                            await this._publishToApi(context, 'message', data);
                            eventEntity.changeState(context, 'follow', this);
                        }
                        break;
                    case 'bpmn:CancelEventDefinition':
                        await this._publishToApi(context, 'cancel', data);
                        eventEntity.changeState(context, 'end', this);
                        await this.end(context, true);
                        break;
                    case 'bpmn:ConditionalEventDefinition':
                        if (boundaryDef.condition) {
                            const functionString = 'return ' + boundaryDef.condition;
                            const evaluateFunction = new Function('token', functionString);
                            tokenData.current = data;
                            let result;
                            try {
                                result = evaluateFunction.call(tokenData, tokenData);
                            }
                            catch (err) {
                                debugErr(`error evaluating condition '${boundaryDef.condition}', key ${boundaryDef.key}`);
                            }
                            if (result) {
                                if (boundaryDef.cancelActivity) {
                                    processToken.data = tokenData;
                                    eventEntity.changeState(context, 'end', this);
                                    this.cancel(internalContext);
                                }
                                else {
                                    const processTokenEntityType = await this.datastoreService.getEntityType('ProcessToken');
                                    const newToken = await processTokenEntityType.createEntity(internalContext);
                                    newToken.process = this.process;
                                    newToken.data = tokenData;
                                    this.processToken = newToken;
                                    await this._publishToApi(context, 'conditional', data);
                                    eventEntity.changeState(context, 'follow', this);
                                }
                            }
                        }
                        break;
                    default:
                }
            }
        }
        cancel(context) {
            debugInfo(`node cancel, id ${this.id}, key ${this.key}, type ${this.type}`);
            this.triggerEvent(context, 'cancel', null);
        }
        async followBoundary(context) {
            debugInfo(`follow boundary, id ${this.id}, key ${this.key}, type ${this.type}`);
            const internalContext = await this.iamService.createInternalContext('processengine_system');
            await this._updateToken(internalContext);
            const nodeInstance = this;
            try {
                await this.nodeInstanceEntityTypeService.continueExecution(context, nodeInstance);
            }
            catch (err) {
                const process = await this.getProcess(internalContext);
                process.error(context, err);
            }
        }
        async _updateToken(context) {
            const processToken = this.processToken;
            const tokenData = processToken.data || {};
            const nodeDef = this.nodeDef;
            const mapper = nodeDef.mapper;
            if (mapper !== undefined) {
                const newCurrent = (new Function('token', 'return ' + mapper)).call(tokenData, tokenData);
                tokenData.current = newCurrent;
            }
            tokenData.history = tokenData.history || {};
            if (tokenData.history.hasOwnProperty(this.key) || this.instanceCounter > 0) {
                if (this.instanceCounter === 1) {
                    const arr = [];
                    arr.push(tokenData.history[this.key]);
                    arr.push(tokenData.current);
                    tokenData.history[this.key] = arr;
                }
                else {
                }
            }
            else {
                tokenData.history[this.key] = tokenData.current;
            }
            processToken.data = tokenData;
            if (this.process.processDef.persist) {
                await processToken.save(context, { reloadAfterSave: false });
            }
        }
        async end(context, cancelFlow = false) {
            debugInfo(`end node, id ${this.id}, key ${this.key}, type ${this.type}`);
            const internalContext = await this.iamService.createInternalContext('processengine_system');
            this.state = 'end';
            this.process.removeActiveInstance(this);
            if (this.process.processDef.persist) {
                await this.save(internalContext, { reloadAfterSave: false });
            }
            const nodeInstance = this;
            const isEndEvent = (nodeInstance.type === 'bpmn:EndEvent');
            await this._updateToken(internalContext);
            const processToken = this.processToken;
            nodeInstance.eventAggregatorSubscription.dispose();
            const messagebusSubscription = await nodeInstance.messagebusSubscription;
            messagebusSubscription.cancel();
            if (this._subscription) {
                this._subscription.dispose();
            }
            const activeInstancesKeys = Object.keys(this.process.activeInstances);
            for (let i = 0; i < activeInstancesKeys.length; i++) {
                const boundaryEntity = this.process.activeInstances[activeInstancesKeys[i]];
                if (boundaryEntity.attachedToInstance && (boundaryEntity.attachedToInstance.id === this.id)) {
                    await boundaryEntity.end(context, true);
                }
            }
            if (!isEndEvent && !cancelFlow) {
                try {
                    await this.nodeInstanceEntityTypeService.continueExecution(context, nodeInstance);
                }
                catch (err) {
                    const process = await this.getProcess(internalContext);
                    process.error(context, err);
                }
            }
            else {
                const process = await this.getProcess(internalContext);
                await process.end(context, processToken);
            }
        }
        parseExtensionProperty(propertyString, token, context) {
            if (typeof propertyString === 'string' && propertyString.length > 1 && propertyString.charAt(0) === '$') {
                const functionString = 'return ' + propertyString.substr(1);
                const evaluateFunction = new Function('token', 'context', functionString);
                let result;
                try {
                    result = evaluateFunction.call(undefined, token, context);
                }
                catch (err) {
                    throw new Error('parsing extension property failed');
                }
                return result;
            }
            else {
                return propertyString;
            }
        }
    };
    __decorate([
        metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
    ], NodeInstanceEntity.prototype, "name", null);
    __decorate([
        metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
    ], NodeInstanceEntity.prototype, "key", null);
    __decorate([
        metadata_1.schemaAttribute({ type: 'Process' })
    ], NodeInstanceEntity.prototype, "process", null);
    __decorate([
        metadata_1.schemaAttribute({ type: 'NodeDef' })
    ], NodeInstanceEntity.prototype, "nodeDef", null);
    __decorate([
        metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
    ], NodeInstanceEntity.prototype, "type", null);
    __decorate([
        metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
    ], NodeInstanceEntity.prototype, "state", null);
    __decorate([
        metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
    ], NodeInstanceEntity.prototype, "participant", null);
    __decorate([
        metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
    ], NodeInstanceEntity.prototype, "application", null);
    __decorate([
        metadata_1.schemaAttribute({ type: 'ProcessToken' })
    ], NodeInstanceEntity.prototype, "processToken", null);
    __decorate([
        metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.number })
    ], NodeInstanceEntity.prototype, "instanceCounter", null);
    NodeInstanceEntity = __decorate([
        metadata_1.schemaClass({
            expandEntity: [
                { attribute: 'nodeDef' }
            ]
        })
    ], NodeInstanceEntity);
    exports.NodeInstanceEntity = NodeInstanceEntity;
});

//# sourceMappingURL=node_instance.js.map
