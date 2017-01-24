import {NodeInstanceEntity} from './node_instance';
import {Entity, IEntityType, IPropertyBag, IFactory, ISchemas} from 'data_model_contracts';
import {IInvoker} from 'invocation_contracts';
import {ExecutionContext} from 'iam_contracts';

export class UserTaskEntity extends NodeInstanceEntity {

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<UserTaskEntity>, context: ExecutionContext, schemas: ISchemas) {
    super(propertyBagFactory, invoker, entityType, context, schemas);
  }
}
