"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug = require("debug");
const debugInfo = debug('processengine:info');
const debugErr = debug('processengine:error');
class ProcessEngineService {
    constructor(messageBusService, eventAggregator, processDefEntityTypeService, featureService, iamService, processRepository, datastoreService) {
        this._messageBusService = undefined;
        this._eventAggregator = undefined;
        this._processDefEntityTypeService = undefined;
        this._featureService = undefined;
        this._iamService = undefined;
        this._processRepository = undefined;
        this._datastoreService = undefined;
        this._activeInstances = {};
        this.config = undefined;
        this._messageBusService = messageBusService;
        this._eventAggregator = eventAggregator;
        this._processDefEntityTypeService = processDefEntityTypeService;
        this._featureService = featureService;
        this._iamService = iamService;
        this._processRepository = processRepository;
        this._datastoreService = datastoreService;
    }
    get messageBusService() {
        return this._messageBusService;
    }
    get eventAggregator() {
        return this._eventAggregator;
    }
    get processDefEntityTypeService() {
        return this._processDefEntityTypeService;
    }
    get featureService() {
        return this._featureService;
    }
    get iamService() {
        return this._iamService;
    }
    get processRepository() {
        return this._processRepository;
    }
    get datastoreService() {
        return this._datastoreService;
    }
    get activeInstances() {
        return this._activeInstances;
    }
    async initialize() {
        console.log('init PE Service 1');
        await this._initializeMessageBus();
        console.log('init PE Service 2');
        await this._initializeProcesses();
        console.log('init PE Service 3');
        await this._startTimers();
        console.log('init PE Service 4');
    }
    async start(context, params, options) {
        const processEntity = await this.processDefEntityTypeService.start(context, params, options);
        return processEntity.id;
    }
    async _messageHandler(msg) {
        debugInfo('we got a message: ', msg);
        await this.messageBusService.verifyMessage(msg);
        const action = (msg && msg.data && msg.data.action) ? msg.data.action : null;
        const key = (msg && msg.data && msg.data.key) ? msg.data.key : null;
        const initialToken = (msg && msg.data && msg.data.token) ? msg.data.token : null;
        let source = (msg && msg.metadata && msg.metadata.applicationId) ? msg.metadata.applicationId : null;
        const participant = (msg && msg.metadata && msg.metadata.options && msg.metadata.options.participantId) ? msg.metadata.options.participantId : null;
        if (!source) {
            source = (msg && msg.origin && msg.origin.id) ? msg.origin.id : null;
        }
        const isSubProcess = (msg && msg.data && msg.data.isSubProcess) ? msg.data.isSubProcess : false;
        const context = (msg && msg.metadata && msg.metadata.context) ? msg.metadata.context : {};
        switch (action) {
            case 'start':
                const params = {
                    key: key,
                    initialToken: initialToken,
                    source: source,
                    isSubProcess: isSubProcess,
                    participant: participant
                };
                await this.processDefEntityTypeService.start(context, params);
                break;
            default:
                debugInfo('unhandled action: ', msg);
                break;
        }
    }
    async _initializeMessageBus() {
        try {
            console.log('initMB1');
            if (this.messageBusService.isMaster) {
                console.log('initMB1.5', this.messageBusService);
                this.messageBusService.subscribe(`/processengine`, this._messageHandler.bind(this));
                console.log('initMB2');
                debugInfo(`subscribed on Messagebus Master`);
            }
            console.log('initMB3');
        }
        catch (err) {
            console.log(err);
            debugErr('subscription failed on Messagebus', err.message);
            throw new Error(err.message);
        }
    }
    async _initializeProcesses() {
        console.log('Init Processes 1');
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        const options = {
            overwriteExisting: false
        };
        console.log('Init Processes 2');
        const processes = this.processRepository.getProcessesByCategory('internal');
        console.log('Init Processes 3');
        for (let i = 0; i < processes.length; i++) {
            const process = processes[i];
            const params = {
                xml: process.bpmnXml,
                internalName: process.name,
                category: process.category,
                module: process.module,
                path: process.path,
                readonly: process.readonly
            };
            await this.processDefEntityTypeService.importBpmnFromXml(internalContext, params, options);
            console.log(`Init Processes 3.${i}`);
        }
        console.log('init processes 4');
    }
    async _startTimers() {
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
        const queryObject = {
            operator: 'and',
            queries: [
                { attribute: 'type', operator: '=', value: 'bpmn:StartEvent' },
                { attribute: 'eventType', operator: '=', value: 'bpmn:TimerEventDefinition' }
            ]
        };
        const startEventColl = await nodeDefEntityType.query(internalContext, { query: queryObject });
        startEventColl.each(internalContext, async (nodeDef) => {
            const processDef = await nodeDef.getProcessDef(internalContext);
            await processDef.startTimer(internalContext);
        });
    }
    addActiveInstance(entity) {
        this._activeInstances[entity.id] = entity;
    }
    removeActiveInstance(entity) {
        if (this._activeInstances.hasOwnProperty(entity.id)) {
            delete this._activeInstances[entity.id];
        }
        entity = null;
    }
}
exports.ProcessEngineService = ProcessEngineService;

//# sourceMappingURL=process_engine_service.js.map
