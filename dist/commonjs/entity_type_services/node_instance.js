"use strict";
class NodeInstanceEntityTypeService {
    constructor(datastoreServiceFactory, messagebusService, iamService, eventAggregator, featureService, routingService) {
        this._datastoreService = undefined;
        this._datastoreServiceFactory = undefined;
        this._messagebusService = undefined;
        this._eventAggregator = undefined;
        this._iamService = undefined;
        this._featureService = undefined;
        this._routingService = undefined;
        this._datastoreServiceFactory = datastoreServiceFactory;
        this._messagebusService = messagebusService;
        this._eventAggregator = eventAggregator;
        this._iamService = iamService;
        this._featureService = featureService;
        this._routingService = routingService;
    }
    get datastoreService() {
        if (!this._datastoreService) {
            this._datastoreService = this._datastoreServiceFactory();
        }
        return this._datastoreService;
    }
    get messagebusService() {
        return this._messagebusService;
    }
    get eventAggregator() {
        return this._eventAggregator;
    }
    get iamService() {
        return this._iamService;
    }
    get featureService() {
        return this._featureService;
    }
    get routingService() {
        return this._routingService;
    }
    async _nodeHandler(msg) {
        const binding = this;
        const action = (msg && msg.data && msg.data.action) ? msg.data.action : null;
        const source = (msg && msg.source) ? msg.source : null;
        const context = (msg && msg.metadata && msg.metadata.context) ? msg.metadata.context : {};
        const applicationId = (msg && msg.metadata && msg.metadata.applicationId) ? msg.metadata.applicationId : null;
        if (action === 'changeState') {
            const newState = (msg && msg.data && msg.data.data) ? msg.data.data : null;
            switch (newState) {
                case ('start'):
                    await binding.entity.start(context, source);
                    break;
                case ('execute'):
                    await binding.entity.execute(context);
                    break;
                case ('end'):
                    await binding.entity.end(context);
                    break;
                default:
            }
        }
        if (action === 'proceed') {
            const newData = (msg && msg.data && msg.data.token) ? msg.data.token : null;
            await binding.entity.proceed(context, newData, source, applicationId);
        }
        if (action === 'event') {
            const event = (msg && msg.data && msg.data.event) ? msg.data.event : null;
            const data = (msg && msg.data && msg.data.data) ? msg.data.data : null;
            await binding.entity.event(context, event, data);
        }
    }
    async createNode(context, entityType) {
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        const node = await entityType.createEntity(internalContext);
        const binding = {
            entity: node,
            eventAggregator: this.eventAggregator
        };
        await this.eventAggregator.subscribe('/processengine/node/' + node.id, this._nodeHandler.bind(binding));
        return node;
    }
    async createNextNode(context, source, nextDef, token) {
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        const process = await source.getProcess(internalContext);
        let participant = source.participant;
        const forceCreateNode = (nextDef.type === 'bpmn:BoundaryEvent') ? true : false;
        const map = new Map();
        map.set('bpmn:UserTask', 'UserTask');
        map.set('bpmn:ExclusiveGateway', 'ExclusiveGateway');
        map.set('bpmn:ParallelGateway', 'ParallelGateway');
        map.set('bpmn:ServiceTask', 'ServiceTask');
        map.set('bpmn:StartEvent', 'StartEvent');
        map.set('bpmn:EndEvent', 'EndEvent');
        map.set('bpmn:ScriptTask', 'ScriptTask');
        map.set('bpmn:BoundaryEvent', 'BoundaryEvent');
        map.set('bpmn:CallActivity', 'SubProcessExternal');
        map.set('bpmn:SubProcess', 'SubProcessInternal');
        const className = map.get(nextDef.type);
        const entityType = await this.datastoreService.getEntityType(className);
        const currentDef = await source.getNodeDef(internalContext);
        const currentLane = await currentDef.getLane(internalContext);
        const nextLane = await nextDef.getLane(internalContext);
        if (currentLane && nextLane && currentLane.id !== nextLane.id) {
            const role = await nextDef.getLaneRole(internalContext);
            if (role) {
                participant = null;
            }
        }
        let node = null;
        if (!forceCreateNode) {
            const queryObj = {
                operator: 'and',
                queries: [
                    { attribute: 'process', operator: '=', value: process.id },
                    { attribute: 'key', operator: '=', value: nextDef.key }
                ]
            };
            node = await entityType.findOne(internalContext, { query: queryObj });
        }
        if (node) {
            const data = {
                action: 'proceed',
                token: null
            };
            const msg = this.messagebusService.createEntityMessage(data, source, context);
            await this.messagebusService.publish('/processengine/node/' + node.id, msg);
        }
        else {
            node = await this.createNode(context, entityType);
            node.name = nextDef.name;
            node.key = nextDef.key;
            node.process = process;
            node.nodeDef = nextDef;
            node.type = nextDef.type;
            node.processToken = token;
            node.participant = participant;
            await node.save(internalContext);
            await node.changeState(context, 'start', source);
        }
    }
    async continueExecution(context, source) {
        const flowDefEntityType = await this.datastoreService.getEntityType('FlowDef');
        const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
        const processTokenEntityType = await this.datastoreService.getEntityType('ProcessToken');
        const nodeInstance = source;
        const splitToken = (nodeInstance.type === 'bpmn:ParallelGateway' && nodeInstance.parallelType === 'split') ? true : false;
        let nextDefs = null;
        const nodeDef = await nodeInstance.getNodeDef(context);
        const processDef = await nodeDef.getProcessDef(context);
        let flowsOut = null;
        if (nodeInstance.follow) {
            if (nodeInstance.follow.length > 0) {
                const queryObjectFollow = {
                    operator: 'and',
                    queries: [
                        { attribute: 'id', operator: 'in', value: nodeInstance.follow },
                        { attribute: 'processDef', operator: '=', value: processDef.id }
                    ]
                };
                flowsOut = await flowDefEntityType.query(context, { query: queryObjectFollow });
            }
        }
        else {
            const queryObjectAll = {
                operator: 'and',
                queries: [
                    { attribute: 'source', operator: '=', value: nodeDef.id },
                    { attribute: 'processDef', operator: '=', value: processDef.id }
                ]
            };
            flowsOut = await flowDefEntityType.query(context, { query: queryObjectAll });
        }
        if (flowsOut && flowsOut.length > 0) {
            const ids = [];
            for (let i = 0; i < flowsOut.data.length; i++) {
                const flow = flowsOut.data[i];
                const target = await flow.target;
                ids.push(target.id);
            }
            const queryObjectIn = {
                operator: 'and',
                queries: [
                    { attribute: 'id', operator: 'in', value: ids },
                    { attribute: 'processDef', operator: '=', value: processDef.id }
                ]
            };
            nextDefs = await nodeDefEntityType.query(context, { query: queryObjectIn });
            if (nextDefs && nextDefs.length > 0) {
                const processToken = await nodeInstance.getProcessToken(context);
                for (let i = 0; i < nextDefs.data.length; i++) {
                    const nextDef = nextDefs.data[i];
                    let currentToken;
                    if (splitToken && i > 0) {
                        currentToken = await processTokenEntityType.createEntity(context);
                        currentToken.process = processToken.process;
                        currentToken.data = processToken.data;
                        await currentToken.save(context);
                    }
                    else {
                        currentToken = processToken;
                    }
                    const lane = await nextDef.getLane(context);
                    const processDef = await nextDef.getProcessDef(context);
                    const nodeFeatures = nextDef.features;
                    const laneFeatures = lane.features;
                    const processFeatures = processDef.features;
                    const features = this.featureService.mergeFeatures(nodeFeatures, laneFeatures, processFeatures);
                    if (features.length === 0 || this.featureService.hasFeatures(features)) {
                        await this.createNextNode(context, nodeInstance, nextDef, currentToken);
                    }
                    else {
                        const appInstances = this.featureService.getApplicationIdsByFeatures(features);
                        if (appInstances.length > 0) {
                            const appInstanceId = appInstances[0];
                            const options = {
                                action: 'POST',
                                typeName: 'ProcessDef',
                                method: 'continueFromRemote'
                            };
                            const data = {
                                source: nodeInstance.getEntityReference(),
                                nextDef: nextDef.getEntityReference(),
                                token: currentToken.getEntityReference()
                            };
                            const message = this.messagebusService.createDatastoreMessage(options, context, data);
                            await this.routingService.send(appInstanceId, message);
                            return;
                        }
                        throw new Error('can not route, no matching instance found');
                    }
                }
            }
        }
    }
    async continueFromRemote(context, params, options) {
        const processTokenEntityType = await this.datastoreService.getEntityType('ProcessToken');
        const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
        const sourceRef = params.source;
        const sourceEntityType = await this.datastoreService.getEntityType(sourceRef.type);
        const source = await sourceEntityType.getById(sourceRef.id, context);
        const tokenRef = params.token;
        const token = await processTokenEntityType.getById(tokenRef.id, context);
        const nextDefRef = params.nextDef;
        const nextDef = await nodeDefEntityType.getById(nextDefRef.id, context);
        await this.createNextNode(context, source, nextDef, token);
    }
}
exports.NodeInstanceEntityTypeService = NodeInstanceEntityTypeService;

//# sourceMappingURL=node_instance.js.map
