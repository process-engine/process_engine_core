import {EventEntity} from './event';
import {EntityDependencyHelper, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, IEntity, IInheritedSchema} from '@process-engine-js/core_contracts';
import {IEndEventEntity} from '@process-engine-js/process_engine_contracts';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

export class EndEventEntity extends EventEntity implements IEndEventEntity {

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

    this.state = 'progress';

    const processToken = this.processToken;
    const currentToken = processToken.data.current;
    const data = {
      action: 'endEvent',
      data: currentToken
    };

    // Todo: move to process.end
    const msg = this.messageBusService.createEntityMessage(data, this, context);
    if (this.participant) {
      await this.messageBusService.publish('/participant/' + this.participant, msg);
    } else {
      // send message to users of lane role
      const role = this.nodeDef.lane.role;
      await this.messageBusService.publish('/role/' + role, msg);
    }

    this.changeState(context, 'end', this);
  }
}
