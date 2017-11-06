import {ExecutionContext, IEntity, IInheritedSchema} from '@essential-projects/core_contracts';
import {EntityDependencyHelper, IEntityType, IPropertyBag} from '@essential-projects/data_model_contracts';
import {IEndEventEntity} from '@process-engine/process_engine_contracts';
import {EventEntity} from './event';
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
      data: currentToken,
    };

    // Todo: move to process.end
    const msg = this.messageBusService.createEntityMessage(data, this, context);
    if (this.participant) {
      await this.messageBusService.publish('/participant/' + this.participant, msg);
    } else {
      // send message to users of lane role
      const configuredRole: string = await this.nodeDef.lane.role;
      const roles: Array<string> = [configuredRole] || ['guest', 'default'];
      const flattenedRoles: Array<string> = this.iamService.flattenRoles(roles);

      for (const flatRole of flattenedRoles) {
        await this.messageBusService.publish(`/role/${flatRole}`, msg);
      }
    }

    this.changeState(context, 'end', this);
  }
}
