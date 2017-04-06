import { EventEntity } from './event';
import { EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { ExecutionContext, IEntity, IInheritedSchema } from '@process-engine-js/core_contracts';
import { ITimerEventEntity, TimerDefinitionType } from '@process-engine-js/process_engine_contracts';
import { IEventAggregator } from '@process-engine-js/event_aggregator_contracts';
import { ITimingService } from '@process-engine-js/timing_contracts';
import { NodeInstanceEntityDependencyHelper } from './node_instance';
export declare class TimerEventEntity extends EventEntity implements ITimerEventEntity {
    private _timingService;
    private _eventAggregator;
    constructor(timingService: ITimingService, eventAggregator: IEventAggregator, nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema);
    private readonly timingService;
    private readonly eventAggregator;
    timerDefinitionType: TimerDefinitionType;
    timerDefinition: string;
    initialize(derivedClassInstance: IEntity): Promise<void>;
    private _startTimer(timerDefinitionType, timerDefinition);
    private _startCycleTimer(timerDefinition, context);
    private _startDurationTimer(timerDefinition, context);
    private _startDateTimer(timerDefinition, context);
    execute(context: ExecutionContext): Promise<void>;
}
