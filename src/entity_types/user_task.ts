import {ExecutionContext, SchemaAttributeType, IEntity, IEntityReference, IInheritedSchema} from '@process-engine-js/core_contracts';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {IUserTaskEntity} from '@process-engine-js/process_engine_contracts';
import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';

export class UserTaskEntity extends NodeInstanceEntity implements IUserTaskEntity {

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
    await this.save(null, internalContext);

    const pojo = await this.toPojo(internalContext);
    const data = {
      action: 'userTask',
      data: pojo
    };

    const origin = this.getEntityReference();

    const meta = {
      jwt: context.encryptedToken
    };

    const msg = this.messageBusService.createMessage(data, origin, meta);
    if (this.participant) {
      await this.messageBusService.publish('/participant/' + this.participant, msg);
    } else {
      // send message to users of lane role
      const role = await this.getLaneRole(context);
      await this.messageBusService.publish('/role/' + role, msg);
    }

  }

  public async proceed(context: ExecutionContext, newData: any, source: IEntityReference): Promise<void> {
    
    const internalContext = await this.iamService.createInternalContext('processengine_system');

    // check if participant changed
    if (this.participant !== source.id) {

    }
    // save new data in token
    const processToken = await this.getProcessToken(internalContext);
    const tokenData = processToken.data || {};
    tokenData.current = newData;
    processToken.data = tokenData;

    await processToken.save(internalContext);

    await this.changeState(context, 'end', this);
  }
}
