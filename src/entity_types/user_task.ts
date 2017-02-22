import {ExecutionContext, SchemaAttributeType, IFactory, IInheritedSchema, IEntity, IEntityReference} from '@process-engine-js/core_contracts';
import {NodeInstanceEntity} from './node_instance';
import {Entity, IEntityType, IPropertyBag, IEncryptionService} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {IUserTaskEntity} from '@process-engine-js/process_engine_contracts';

export class UserTaskEntity extends NodeInstanceEntity implements IUserTaskEntity {

  constructor(nodeInstanceHelper: any, propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<IUserTaskEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(nodeInstanceHelper, propertyBagFactory, encryptionService, invoker, entityType, context, schema);
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  public async execute(context: ExecutionContext) {

    const internalContext = await this.helper.iamService.createInternalContext('processengine_system');
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

    const msg = this.helper.messagebusService.createMessage(data, origin, meta);
    if (this.participant) {
      await this.helper.messagebusService.publish('/participant/' + this.participant, msg);
    } else {
      // send message to users of lane role
      const role = await this.getLaneRole(context);
      await this.helper.messagebusService.publish('/role/' + role, msg);
    }

  }

  public async proceed(context: ExecutionContext, newData: any, source: IEntityReference) {
    // check if participant changed
    if (this.participant !== source.id) {

    }
    // save new data in token
    const processToken = await this.getProcessToken();
    const tokenData = processToken.data || {};
    tokenData.current = newData;
    processToken.data = tokenData;

    const internalContext = await this.helper.iamService.createInternalContext('processengine_system');
    await processToken.save(internalContext);

    await this.changeState(context, 'end', this);
  }
}
