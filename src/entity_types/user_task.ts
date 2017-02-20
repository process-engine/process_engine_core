import {ExecutionContext, SchemaAttributeType, IFactory, IInheritedSchema, IEntity} from '@process-engine-js/core_contracts';
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
}
