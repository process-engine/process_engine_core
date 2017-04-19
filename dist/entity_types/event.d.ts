import { NodeInstanceEntity } from './node_instance';
import { EntityDependencyHelper } from '@process-engine-js/data_model_contracts';
import { ExecutionContext, IEntity, IEntityReference, IInheritedSchema } from '@process-engine-js/core_contracts';
import { IEventEntity, TimerDefinitionType } from '@process-engine-js/process_engine_contracts';
import { NodeInstanceEntityDependencyHelper } from './node_instance';
export declare class EventEntity extends NodeInstanceEntity implements IEventEntity {
    config: any;
    constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, entityDependencyHelper: EntityDependencyHelper, context: ExecutionContext, schema: IInheritedSchema);
    protected readonly timerDefinitionType: TimerDefinitionType;
    protected readonly timerDefinition: any;
    initialize(derivedClassInstance: IEntity): Promise<void>;
    private initializeTimer();
    proceed(context: ExecutionContext, data: any, source: IEntityReference, applicationId: string): Promise<void>;
    private _startCycleTimer(timerDefinition, context);
    private _startDurationTimer(timerDefinition, context);
    private _startDateTimer(timerDefinition, context);
    protected handleTimerElapsed(context: ExecutionContext): void;
    _signalSubscribe(signal: string): Promise<void>;
    private _signalHandler(msg);
}
