"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class NodeInstanceEntityTypeService {
    constructor(datastoreService, messagebusService, iamService) {
        this._datastoreService = undefined;
        this._messagebusService = undefined;
        this._iamService = undefined;
        this._datastoreService = datastoreService;
        this._messagebusService = messagebusService;
        this._iamService = iamService;
    }
    get datastoreService() {
        return this._datastoreService;
    }
    get messagebusService() {
        return this._messagebusService;
    }
    get iamService() {
        return this._iamService;
    }
    async createNode(context, entityType) {
        async function nodeHandler(msg) {
            msg = await this.messagebus.verifyMessage(msg);
            const action = (msg && msg.data && msg.data.action) ? msg.data.action : null;
            const source = (msg && msg.origin) ? msg.origin : null;
            const context = (msg && msg.meta && msg.meta.context) ? msg.meta.context : {};
            if (action === 'changeState') {
                const newState = (msg && msg.data && msg.data.data) ? msg.data.data : null;
                switch (newState) {
                    case ('start'):
                        await this.entity.start(context, source);
                        break;
                    case ('execute'):
                        await this.entity.execute(context);
                        break;
                    case ('end'):
                        await this.entity.end(context);
                        break;
                    default:
                }
            }
            if (action === 'proceed') {
                const newData = (msg && msg.data && msg.data.token) ? msg.data.token : null;
                await this.entity.proceed(context, newData, source);
            }
            if (action === 'event') {
                const event = (msg && msg.data && msg.data.event) ? msg.data.event : null;
                const data = (msg && msg.data && msg.data.data) ? msg.data.data : null;
                await this.entity.event(context, event, data);
            }
        }
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        const node = await entityType.createEntity(internalContext);
        const binding = {
            entity: node,
            messagebus: this.messagebusService
        };
        await this.messagebusService.subscribe('/processengine/node/' + node.id, nodeHandler.bind(binding));
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
        // check for lane change
        if (currentLane && nextLane && currentLane.id !== nextLane.id) {
            // if we have a new lane, create a temporary context with lane role
            const role = await nextDef.getLaneRole(internalContext);
            if (role) {
                // Todo: refactor lane change
                /*const identityContext = await context.createNewContext('identity');
                const tempUser = role + source.id;
        
                const identity = model._datastore._processengine.identity;
                await identity.addSystemUser(tempUser, { roles: [role] }, identityContext);
        
                const jwt = await identity.loginByToken(tempUser);
                // use new context of temporary lane user
                context = await identity.token.verifyToken(jwt);*/
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
            const meta = {
                jwt: context.encryptedToken
            };
            const data = {
                action: 'proceed',
                token: null
            };
            const origin = source.getEntityReference();
            const msg = this.messagebusService.createMessage(data, origin, meta);
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
}
exports.NodeInstanceEntityTypeService = NodeInstanceEntityTypeService;

//# sourceMappingURL=node_instance.js.map
