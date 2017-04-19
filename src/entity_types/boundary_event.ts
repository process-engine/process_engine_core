import {EventEntity} from './event';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema} from '@process-engine-js/core_contracts';
import {IBoundaryEventEntity} from '@process-engine-js/process_engine_contracts';
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
    const internalContext = await this.iamService.createInternalContext('processengine_system');
    this.state = 'wait';
    await this.save(internalContext);

    const nodeDef = this.nodeDef;

    switch (nodeDef.eventType) {
      case 'bpmn:SignalEventDefinition':
        const signal = nodeDef.signal;
        await this._signalSubscribe(signal);
        break;

      default:
    }


  }

  public async proceed(context: ExecutionContext, newData: any): Promise<void> {
    this.changeState(context, 'end', this);
  }
}
