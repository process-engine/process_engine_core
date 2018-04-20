import {ExecutionContext, IEntity, IInheritedSchema} from '@essential-projects/core_contracts';
import {EntityDependencyHelper, IEntityType, IPropertyBag} from '@essential-projects/data_model_contracts';
import {IEntityMessage} from '@essential-projects/messagebus_contracts';
import {IEndEventEntity, IProcessTokenEntity} from '@process-engine/process_engine_contracts';
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

  public async execute(context: ExecutionContext): Promise<void> {

    if (this.nodeDef.belongsToSubProcessKey !== undefined) {
      return super.execute();
    }

    this.state = 'progress';

    const processToken: IProcessTokenEntity = this.processToken;
    const currentToken: any = processToken.data.current;
    const data: any = {
      action: 'endEvent',
      data: currentToken,
      endEventKey: this.key,
    };

    // Todo: move to process.end
    const msg: IEntityMessage = this.messageBusService.createEntityMessage(data, this, context);
    if (this.participant) {
      await this.messageBusService.publish(`/participant/${this.participant}`, msg);
    } else {
      // send message to users of lane role
      const configuredRole: string = await this.nodeDef.lane.role;
      const roles: Array<string> = configuredRole ? [configuredRole] : ['guest', 'default'];
      const flattenedRoles: Array<string> = this.iamService.flattenRoles(roles);

      for (const flatRole of flattenedRoles) {
        await this.messageBusService.publish(`/role/${flatRole}`, msg);
      }
    }
    this.changeState(context, 'end', this);
  }
}
