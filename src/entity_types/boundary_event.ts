import {EventEntity} from './event';
import {ExecutionContext, SchemaAttributeType, IFactory, IInheritedSchema, IEntity} from '@process-engine-js/core_contracts';
import {IEntityType, IPropertyBag, IEncryptionService} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {IBoundaryEventEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';

export class BoundaryEventEntity extends EventEntity implements IBoundaryEventEntity {

  constructor(propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<IBoundaryEventEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(propertyBagFactory, encryptionService, invoker, entityType, context, schema);
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }
}
