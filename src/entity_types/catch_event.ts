import { ExecutionContext, IEntity, IInheritedSchema } from '@process-engine-js/core_contracts';
import { EntityDependencyHelper, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import { ICatchEventEntity } from '@process-engine-js/process_engine_contracts';
import { EventEntity } from './event';
import { NodeInstanceEntityDependencyHelper } from './node_instance';

export class CatchEventEntity extends EventEntity implements ICatchEventEntity {

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper,
              entityDependencyHelper: EntityDependencyHelper,
              context: ExecutionContext,
              schema: IInheritedSchema,
              propertyBag: IPropertyBag,
              entityType: IEntityType<IEntity>) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType);
  }

  public async initialize(): Promise<void> {
    await super.initialize(this);
  }

  public async execute(context: ExecutionContext) {

    this.changeState(context, 'wait', this);

    const nodeDef = this.nodeDef;

    switch (nodeDef.eventType) {
      case 'bpmn:SignalEventDefinition':
        await this.initializeSignal();
        break;

      case 'bpmn:MessageEventDefinition':
        await this.initializeMessage();
        break;

      case 'bpmn:TimerEventDefinition':
        await this.initializeTimer();
        break;

      default:
      // no support of other event definition, simply end task
        this.changeState(context, 'end', this);
    }

  }

  public async proceed(context: ExecutionContext, newData: any, source: IEntity, applicationId: string, participant: string): Promise<void> {
    this.changeState(context, 'end', this);
  }
}
