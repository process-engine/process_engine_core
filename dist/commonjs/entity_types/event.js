"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_instance_1 = require("./node_instance");
const process_engine_contracts_1 = require("@process-engine-js/process_engine_contracts");
const moment = require("moment");
const debug = require("debug");
const debugInfo = debug('processengine:info');
class EventEntity extends node_instance_1.NodeInstanceEntity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
        this.config = undefined;
    }
    async initialize(derivedClassInstance) {
        const actualInstance = derivedClassInstance || this;
        await super.initialize(actualInstance);
    }
    async initializeTimer() {
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        switch (this.nodeDef.timerDefinitionType) {
            case process_engine_contracts_1.TimerDefinitionType.cycle:
                await this._startCycleTimer(this.nodeDef.timerDefinition, internalContext);
                break;
            case process_engine_contracts_1.TimerDefinitionType.date:
                await this._startDateTimer(this.nodeDef.timerDefinition, internalContext);
                break;
            case process_engine_contracts_1.TimerDefinitionType.duration:
                await this._startDurationTimer(this.nodeDef.timerDefinition, internalContext);
                break;
            default:
        }
    }
    async _startCycleTimer(timerDefinition, context) {
        const duration = moment.duration(timerDefinition);
        const timingRule = {
            year: duration.years(),
            month: duration.months(),
            date: duration.days(),
            hour: duration.hours(),
            minute: duration.minutes(),
            second: duration.seconds()
        };
        const channelName = `events/timer/${this.id}`;
        this.eventAggregator.subscribe(channelName, () => {
            this._handleTimerElapsed(context);
        });
        await this.timingService.periodic(timingRule, channelName, context);
    }
    async _startDurationTimer(timerDefinition, context) {
        const duration = moment.duration(timerDefinition);
        const date = moment().add(duration);
        const channelName = `events/timer/${this.id}`;
        this.eventAggregator.subscribeOnce(channelName, () => {
            this._handleTimerElapsed(context);
        });
        await this.timingService.once(date, channelName, context);
    }
    async _startDateTimer(timerDefinition, context) {
        const date = moment(timerDefinition);
        const channelName = `events/timer/${this.id}`;
        this.eventAggregator.subscribeOnce(channelName, () => {
            this._handleTimerElapsed(context);
        });
        await this.timingService.once(date, channelName, context);
    }
    _handleTimerElapsed(context) {
        this._sendProceed(context, null, this);
    }
    _sendProceed(context, data, source) {
        data = data || {};
        data.action = 'proceed';
        const event = this.eventAggregator.createEntityEvent(data, source, context, (source && ('participant' in source) ? { participantId: source.participant } : null));
        this.eventAggregator.publish('/processengine/node/' + this.id, event);
    }
    async initializeSignal() {
        const signal = this.nodeDef.signal;
        const binding = {
            entity: this,
            eventAggregator: this.eventAggregator,
            messagebusService: this.messageBusService,
            datastoreService: this.datastoreService
        };
        this.messagebusSubscription = this.messageBusService.subscribe('/processengine/signal/' + signal, this._signalHandler.bind(binding));
    }
    async _signalHandler(msg) {
        const binding = this;
        await binding.messagebusService.verifyMessage(msg);
        const context = (msg && msg.metadata && msg.metadata.context) ? msg.metadata.context : {};
        const sourceRef = (msg && msg.source) ? msg.source : null;
        let source = null;
        if (sourceRef) {
            const sourceProcessRef = msg && msg.data && msg.data.process ? msg.data.process : undefined;
            if (sourceProcessRef) {
                if (binding.entity.processEngineService.activeInstances.hasOwnProperty(sourceProcessRef.id)) {
                    const sourceProcess = binding.entity.processEngineService.activeInstances[sourceProcessRef.id];
                    source = sourceProcess.allInstances[sourceRef.id];
                }
            }
            if (!source) {
                const entityType = await binding.datastoreService.getEntityType(sourceRef._meta.type);
                try {
                    source = await entityType.getById(sourceRef.id, context);
                }
                catch (err) {
                }
            }
        }
        const data = (msg && msg.data) ? msg.data : null;
        debugInfo(`signal '${binding.entity.nodeDef.signal}' received for node key '${binding.entity.key}'`);
        binding.entity._sendProceed(context, data, source);
    }
    async initializeMessage() {
        const message = this.nodeDef.message;
        const binding = {
            entity: this,
            eventAggregator: this.eventAggregator,
            messagebusService: this.messageBusService,
            datastoreService: this.datastoreService
        };
        this.messagebusSubscription = this.messageBusService.subscribe('/processengine/message/' + message, this._messageHandler.bind(binding));
    }
    async _messageHandler(msg) {
        const binding = this;
        await binding.messagebusService.verifyMessage(msg);
        const context = (msg && msg.metadata && msg.metadata.context) ? msg.metadata.context : {};
        const sourceRef = (msg && msg.source) ? msg.source : null;
        let source = null;
        if (sourceRef) {
            const entityType = await binding.datastoreService.getEntityType(sourceRef._meta.type);
            try {
                source = await entityType.getById(sourceRef.id, context);
            }
            catch (err) {
            }
        }
        const data = (msg && msg.data) ? msg.data : null;
        debugInfo(`message '${binding.entity.nodeDef.message}' received for node key '${binding.entity.key}'`);
        binding.entity._sendProceed(context, data, source);
    }
}
exports.EventEntity = EventEntity;

//# sourceMappingURL=event.js.map
