import {NodeInstanceEntity} from './node_instance';
import {IFactory, IInheritedSchema} from '@process-engine-js/core_contracts';
import {Entity, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {ExecutionContext} from '@process-engine-js/core_contracts';

export class ServiceTaskEntity extends NodeInstanceEntity {

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<ServiceTaskEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(propertyBagFactory, invoker, entityType, context, schema);
  }
}
