import { EventEntity } from './event';
import { EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { ExecutionContext, IEntity, IInheritedSchema, IEntityReference } from '@process-engine-js/core_contracts';
import { ITimerEventEntity, TimerDefinitionType } from '@process-engine-js/process_engine_contracts';
import { ITimingService } from '@process-engine-js/timing_contracts';
import { NodeInstanceEntityDependencyHelper } from './node_instance';
export declare class TimerEventEntity extends EventEntity implements ITimerEventEntity {
    private _timingService;
    constructor(timingService: ITimingService, nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema);
    private readonly timingService;
    timerDefinitionType: TimerDefinitionType;
    timerDefinition: string;
    initialize(derivedClassInstance: IEntity): Promise<void>;
    execute(context: ExecutionContext): Promise<void>;
    proceed(context: ExecutionContext, data: any, source: IEntityReference, applicationId: string): Promise<void>;
    private _startTimer(timerDefinitionType, timerDefinition, context);
    private _startCycleTimer(timerDefinition, context);
    private _startDurationTimer(timerDefinition, context);
    private _startDateTimer(timerDefinition, context);
    private _prepareStartTimer(channelName, context);
    private _timerElapsed(context);
}
