import { ExecutionContext, IEntity, IInheritedSchema } from '@process-engine-js/core_contracts';
import { EntityDependencyHelper, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import { IThrowEventEntity } from '@process-engine-js/process_engine_contracts';
import { EventEntity } from './event';
import { NodeInstanceEntityDependencyHelper } from './node_instance';

export class ThrowEventEntity extends EventEntity implements IThrowEventEntity {

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
    let data;
    let msg;

    switch (nodeDef.eventType) {
      case 'bpmn:SignalEventDefinition':

        const signal = this.nodeDef.signal;
        data = {
          process: this.process.getEntityReference().toPojo(),
          token: this.processToken.data.current,
        };

        msg = this.messageBusService.createEntityMessage(data, this, context);
        await this.messageBusService.publish('/processengine/signal/' + signal, msg);

        break;

      case 'bpmn:MessageEventDefinition':

        const message = this.nodeDef.message;
        data = {
          process: this.process.getEntityReference().toPojo(),
          token: this.processToken.data.current,
        };

        msg = this.messageBusService.createEntityMessage(data, this, context);
        await this.messageBusService.publish('/processengine/message/' + message, msg);

        break;

      default:

    }

    this.changeState(context, 'end', this);

  }
}
