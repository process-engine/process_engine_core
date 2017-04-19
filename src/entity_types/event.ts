import {NodeInstanceEntity} from './node_instance';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema} from '@process-engine-js/core_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {IEventEntity} from '@process-engine-js/process_engine_contracts';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

export class EventEntity extends NodeInstanceEntity implements IEventEntity {

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

  async _signalSubscribe(signal: string): Promise<void> {
    const binding = {
      entity: this,
      eventAggregator: this.eventAggregator,
      messagebusService: this.messageBusService,
      datastoreService: this.datastoreService
    };
    this.messagebusSubscription = this.messageBusService.subscribe('/processengine/signal/' + signal, this._signalHandler.bind(binding));

  }

  private async _signalHandler(msg: any) {

  }
}
