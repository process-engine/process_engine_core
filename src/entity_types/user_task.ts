import {ExecutionContext, IEntity, IInheritedSchema} from '@essential-projects/core_contracts';
import {EntityDependencyHelper, IEntityType, IPropertyBag} from '@essential-projects/data_model_contracts';
import {schemaClass} from '@essential-projects/metadata';
import { IBoundaryEventEntity, IUserTaskEntity, IUserTaskMessageData} from '@process-engine/process_engine_contracts';
import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';

@schemaClass({
  expandEntity: [
    { attribute: 'nodeDef' },
    { attribute: 'processToken' },
  ],
})
export class UserTaskEntity extends NodeInstanceEntity implements IUserTaskEntity {

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

    const internalContext = await this.iamService.createInternalContext('processengine_system');

    const laneRole = await this.getLaneRole(internalContext);
    if (!context.hasRole(laneRole)) {
      this.participant = null;
    }

    this.changeState(context, 'wait', this);

    const data = {
      action: 'userTask',
      data: await this.getUserTaskData(context),
    };

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

  }

  public async getUserTaskData(context: ExecutionContext): Promise<IUserTaskMessageData> {

    const internalContext: ExecutionContext = await this.iamService.createInternalContext('processengine_system');

    const pojo = await this.toPojo(internalContext, {maxDepth: 1});
    let uiName;
    let uiConfig;

    const processToken = pojo.processToken;
    const token = processToken.data || {};
    let uiData = token;

    const nodeDef = this.nodeDef;
    const extensions = nodeDef.extensions || null;
    const props = (extensions && extensions.properties) ? extensions.properties : null;
    if (props) {
      props.forEach((prop) => {
        if (prop.name === 'uiName') {
          uiName = <string> this.parseExtensionProperty(prop.value, token, context);
        }
        if (prop.name === 'uiConfig') {
          uiConfig = this.parseExtensionProperty(prop.value, token, context);
        }
        if (prop.name === 'uiData') {
          uiData = this.parseExtensionProperty(prop.value, token, context);
        }
      });
    }

    const userTaskMessageData: IUserTaskMessageData = {
      userTaskEntity: pojo,
      uiName: uiName,
      uiData: uiData,
      uiConfig: uiConfig,
    };

    return userTaskMessageData;
  }

  public async proceed(context: ExecutionContext, newData: any, source: IEntity, applicationId: string, participant: string): Promise<void> {

    // check if participant changed
    if (this.participant !== participant) {
      this.participant = participant;
    }

    // save new data in token
    const processToken = this.processToken;
    const tokenData = processToken.data || {};
    tokenData.current = newData;
    processToken.data = tokenData;

    this.changeState(context, 'end', this);
  }
}
