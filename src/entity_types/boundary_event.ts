import {ExecutionContext, IEntity, IInheritedSchema} from '@process-engine-js/core_contracts';
import {EntityDependencyHelper, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {IBoundaryEventEntity, INodeInstanceEntity} from '@process-engine-js/process_engine_contracts';
import {EventEntity} from './event';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

export class BoundaryEventEntity extends EventEntity implements IBoundaryEventEntity {

  public attachedToInstance: INodeInstanceEntity = undefined;

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

    }

    const internalContext = await this.iamService.createInternalContext('processengine_system');

    if (this.process.processDef.persist) {
      await this.save(internalContext, { reloadAfterSave: false });
    }
    this.changeState(context, 'wait', this);
  }

  public async proceed(context: ExecutionContext, data: any, source: INodeInstanceEntity, applicationId: string, participant: string): Promise<void> {
    const parent = this.attachedToInstance;
    await parent.triggerBoundaryEvent(context, this, data);
  }
}
