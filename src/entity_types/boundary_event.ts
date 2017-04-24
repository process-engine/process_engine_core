import {EventEntity} from './event';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema, IEntityReference, IQueryObject} from '@process-engine-js/core_contracts';
import {IBoundaryEventEntity, TimerDefinitionType} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

export class BoundaryEventEntity extends EventEntity implements IBoundaryEventEntity {

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, 
              entityDependencyHelper: EntityDependencyHelper, 
              context: ExecutionContext,
              schema: IInheritedSchema) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  public async execute(context: ExecutionContext) {

    const nodeDef = this.nodeDef;

    switch (nodeDef.eventType) {
      case 'bpmn:SignalEventDefinition':
        this.changeState(context, 'wait', this);
        await this.initializeSignal();
        break;

      case 'bpmn:MessageEventDefinition':
        this.changeState(context, 'wait', this);
        await this.initializeMessage();
        break;

      case 'bpmn:TimerEventDefinition':
        this.changeState(context, 'wait', this);
        await this.initializeTimer();
        break;

      default:
        this.changeState(context, 'end', this);
    }

  }

  public async proceed(context: ExecutionContext, data: any, source: IEntity, applicationId: string): Promise<void> {

    const internalContext = await this.iamService.createInternalContext('processengine_system');

    const nodeInstanceEntityType = await this.datastoreService.getEntityType('NodeInstance');

    const attachedToNode = await this.nodeDef.getAttachedToNode(context); 
    const targetKey = attachedToNode.key;
    const process = this.process;

    const queryObj: IQueryObject = {
      operator: 'and',
      queries: [
        { attribute: 'key', operator: '=', value: targetKey },
        { attribute: 'process', operator: '=', value: process.id }
      ]
    };

    const target = await nodeInstanceEntityType.findOne(internalContext, { query: queryObj });

    let payload;

    if (this.nodeDef.timerDefinitionType !== TimerDefinitionType.cycle || this.nodeDef.cancelActivity) {
      
      payload = {
        action: 'changeState',
        data: 'end'
      };
      
    } else {

      payload = {
        action: 'event',
        data: {
          event: 'timer',
          data: {}
        }
      };
    }

    const event = this.eventAggregator.createEntityEvent(payload, source, context);
    this.eventAggregator.publish('/processengine/node/' + target.id, event);
  }
}
