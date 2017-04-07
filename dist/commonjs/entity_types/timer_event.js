"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const event_1 = require("./event");
const core_contracts_1 = require("@process-engine-js/core_contracts");
const process_engine_contracts_1 = require("@process-engine-js/process_engine_contracts");
const metadata_1 = require("@process-engine-js/metadata");
const moment = require("moment");
class TimerEventEntity extends event_1.EventEntity {
    constructor(timingService, eventAggregator, nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema) {
        super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
        this._timingService = undefined;
        this._eventAggregator = undefined;
        this._timingService = timingService;
        this._eventAggregator = eventAggregator;
    }
    get timingService() {
        return this._timingService;
    }
    get eventAggregator() {
        return this._eventAggregator;
    }
    get timerDefinitionType() {
        return this.getProperty(this, 'timerDefinitionType');
    }
    set timerDefinitionType(value) {
        this.setProperty(this, 'timerDefinitionType', value);
    }
    get timerDefinition() {
        return this.getProperty(this, 'timerDefinition');
    }
    set timerDefinition(value) {
        this.setProperty(this, 'timerDefinition', value);
    }
    async initialize(derivedClassInstance) {
        const actualInstance = derivedClassInstance || this;
        await super.initialize(actualInstance);
    }
    async execute(context) {
        await this._startTimer(this.timerDefinitionType, this.timerDefinition, context);
    }
    async proceed(context, data, source, applicationId) {
        if (this.timerDefinitionType === process_engine_contracts_1.TimerDefinitionType.cycle) {
            await this.event(context, 'timer', {});
        }
        else {
            await this.changeState(context, 'end', this);
        }
    }
    async _startTimer(timerDefinitionType, timerDefinition, context) {
        switch (timerDefinitionType) {
            case process_engine_contracts_1.TimerDefinitionType.cycle: await this._startCycleTimer(timerDefinition, context);
            case process_engine_contracts_1.TimerDefinitionType.date: await this._startDateTimer(timerDefinition, context);
            case process_engine_contracts_1.TimerDefinitionType.duration: await this._startDurationTimer(timerDefinition, context);
            default: return;
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
        await this._prepareStartTimer(channelName, context);
        await this.timingService.periodic(timingRule, channelName, context);
    }
    async _startDurationTimer(timerDefinition, context) {
        const duration = moment.duration(timerDefinition);
        const date = moment().add(duration);
        const channelName = `events/timer/${this.id}`;
        await this._prepareStartTimer(channelName, context);
        await this.timingService.once(date, channelName, context);
    }
    async _startDateTimer(timerDefinition, context) {
        const date = moment(timerDefinition);
        const channelName = `events/timer/${this.id}`;
        await this._prepareStartTimer(channelName, context);
        await this.timingService.once(date, channelName, context);
    }
    async _prepareStartTimer(channelName, context) {
        this.eventAggregator.subscribeOnce(channelName, async () => {
            await this._timerElapsed(context);
        });
        await this.changeState(context, 'wait', this);
    }
    async _timerElapsed(context) {
        const data = {
            action: 'proceed'
        };
        const message = this.messageBusService.createEntityMessage(data, this, context);
        await this.messageBusService.publish(`/processengine/node/${this.id}`, message);
    }
}
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.number })
], TimerEventEntity.prototype, "timerDefinitionType", null);
__decorate([
    metadata_1.schemaAttribute({ type: core_contracts_1.SchemaAttributeType.string })
], TimerEventEntity.prototype, "timerDefinition", null);
exports.TimerEventEntity = TimerEventEntity;

//# sourceMappingURL=timer_event.js.map
