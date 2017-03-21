import {EventEntity} from './event';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema} from '@process-engine-js/core_contracts';
import {IEndEventEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

export class EndEventEntity extends EventEntity implements IEndEventEntity {

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
    this.state = 'progress';
    await this.save(internalContext);

    const processToken = await this.getProcessToken(internalContext);
    const currentToken = processToken.data.current;
    const data = {
      action: 'endEvent',
      data: currentToken
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
      const role = await this.getLaneRole(internalContext);
      await this.messageBusService.publish('/role/' + role, msg);
    }

    await this.changeState(context, 'end', this);
  }
}
