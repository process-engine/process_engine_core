"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_instance_1 = require("./node_instance");
const process_engine_contracts_1 = require("@process-engine-js/process_engine_contracts");
const moment = require("moment");
class EventEntity extends node_instance_1.NodeInstanceEntity {
    constructor(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
        this.config = undefined;
    }
    get timerDefinitionType() {
        return this.nodeDef.timerDefinitionType;
    }
    get timerDefinition() {
        return this.nodeDef.timerDefinition;
    }
    async initialize(derivedClassInstance) {
        const actualInstance = derivedClassInstance || this;
        await super.initialize(actualInstance);
        await this.initializeTimer();
    }
    async initializeTimer() {
        const context = await this.iamService.createInternalContext(this.config.systemUser);
        await this.getNodeDef(context);
        switch (this.timerDefinitionType) {
            case process_engine_contracts_1.TimerDefinitionType.cycle:
                await this._startCycleTimer(this.nodeDef.timerDefinition, context);
                break;
            case process_engine_contracts_1.TimerDefinitionType.date:
                await this._startDateTimer(this.nodeDef.timerDefinition, context);
                break;
            case process_engine_contracts_1.TimerDefinitionType.duration:
                await this._startDurationTimer(this.nodeDef.timerDefinition, context);
                break;
            default:
        }
        await this.changeState(context, 'wait', this);
    }
    async proceed(context, data, source, applicationId) {
        if (this.timerDefinitionType === process_engine_contracts_1.TimerDefinitionType.cycle) {
            await this.event(context, 'timer', {});
        }
        else {
            await this.changeState(context, 'end', this);
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
        this.eventAggregator.subscribe(channelName, async () => {
            await this.handleTimerElapsed(context);
        });
        await this.timingService.periodic(timingRule, channelName, context);
    }
    async _startDurationTimer(timerDefinition, context) {
        const duration = moment.duration(timerDefinition);
        const date = moment().add(duration);
        const channelName = `events/timer/${this.id}`;
        this.eventAggregator.subscribeOnce(channelName, async () => {
            await this.handleTimerElapsed(context);
        });
        await this.timingService.once(date, channelName, context);
    }
    async _startDateTimer(timerDefinition, context) {
        const date = moment(timerDefinition);
        const channelName = `events/timer/${this.id}`;
        this.eventAggregator.subscribeOnce(channelName, async () => {
            await this.handleTimerElapsed(context);
        });
        await this.timingService.once(date, channelName, context);
    }
    handleTimerElapsed(context) {
        const data = {
            action: 'proceed'
        };
        const event = this.eventAggregator.createEntityEvent(data, this, context);
        this.eventAggregator.publish('/processengine/node/' + this.id, event);
    }
    async _signalSubscribe(signal) {
        const binding = {
            entity: this,
            eventAggregator: this.eventAggregator,
            messagebusService: this.messageBusService,
            datastoreService: this.datastoreService
        };
        this.messagebusSubscription = this.messageBusService.subscribe('/processengine/signal/' + signal, this._signalHandler.bind(binding));
    }
    async _signalHandler(msg) {
    }
}
exports.EventEntity = EventEntity;

//# sourceMappingURL=event.js.map
