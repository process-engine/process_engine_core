"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug = require("debug");
const debugInfo = debug('process_engine:info');
const debugErr = debug('process_engine:error');
class ProcessEngineService {
    constructor(messageBusService, eventAggregator, processDefEntityTypeService, featureService, iamService, processRepository, datastoreServiceFactory) {
        this._messageBusService = undefined;
        this._eventAggregator = undefined;
        this._processDefEntityTypeService = undefined;
        this._featureService = undefined;
        this._iamService = undefined;
        this._processRepository = undefined;
        this._datastoreService = undefined;
        this._datastoreServiceFactory = undefined;
        this._runningProcesses = {};
        this._processTokenCache = {};
        this.config = undefined;
        this._messageBusService = messageBusService;
        this._eventAggregator = eventAggregator;
        this._processDefEntityTypeService = processDefEntityTypeService;
        this._featureService = featureService;
        this._iamService = iamService;
        this._processRepository = processRepository;
        this._datastoreServiceFactory = datastoreServiceFactory;
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
        if (!this._datastoreService) {
            this._datastoreService = this._datastoreServiceFactory();
        }
        return this._datastoreService;
    }
    get runningProcesses() {
        return this._runningProcesses;
    }
    get processTokenCache() {
        return this._processTokenCache;
    }
    async initialize() {
        this.featureService.initialize();
        await this._initializeMessageBus();
        await this._initializeProcesses();
        await this._startTimers();
    }
    async start(context, params, options) {
        const processEntity = await this.processDefEntityTypeService.start(context, params, options);
        this.runningProcesses[processEntity.id] = processEntity;
        return processEntity.id;
    }
    async _messageHandler(msg) {
        debugInfo('we got a message: ', msg);
        await this.messageBusService.verifyMessage(msg);
        const action = (msg && msg.data && msg.data.action) ? msg.data.action : null;
        const key = (msg && msg.data && msg.data.key) ? msg.data.key : null;
        const initialToken = (msg && msg.data && msg.data.token) ? msg.data.token : null;
        let source = (msg && msg.metadata && msg.metadata.applicationId) ? msg.metadata.applicationId : null;
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
                    isSubProcess: isSubProcess
                };
                const processEntity = await this.processDefEntityTypeService.start(context, params);
                debugInfo(`process id ${processEntity.id} started: `);
                break;
            default:
                debugInfo('unhandled action: ', msg);
                break;
        }
    }
    async _initializeMessageBus() {
        try {
            if (this.messageBusService.isMaster) {
                await this.messageBusService.subscribe(`/processengine`, this._messageHandler.bind(this));
                debugInfo(`subscribed on Messagebus Master`);
            }
        }
        catch (err) {
            debugErr('subscription failed on Messagebus', err.message);
            throw new Error(err.message);
        }
    }
    async _initializeProcesses() {
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        const options = {
            overwriteExisting: true
        };
        this.processRepository.initialize();
        const processes = this.processRepository.getProcessesByCategory('internal');
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
        }
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
}
exports.ProcessEngineService = ProcessEngineService;

//# sourceMappingURL=process_engine_service.js.map
