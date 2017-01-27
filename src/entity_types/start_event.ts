import {ExecutionContext, SchemaAttributeType, IFactory, IInheritedSchema} from '@process-engine-js/core_contracts';
import {EventEntity} from './event';
import {Entity, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {IStartEventEntity} from '@process-engine-js/process_engine_contracts';

export class StartEventEntity extends EventEntity implements IStartEventEntity {

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<StartEventEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(propertyBagFactory, invoker, entityType, context, schema);
  }
}
