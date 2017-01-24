import {NodeInstanceEntity} from './node_instance';
import {Entity, IEntityType, IPropertyBag, IFactory, ISchemas} from 'data_model_contracts';
import {IInvoker} from 'invocation_contracts';
import {ExecutionContext} from 'iam_contracts';

export class ScriptTaskEntity extends NodeInstanceEntity {

  static attributes: any = {
    script: { type: 'string' }
  };

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<ScriptTaskEntity>, context: ExecutionContext, schemas: ISchemas) {
    super(propertyBagFactory, invoker, entityType, context, schemas);
  }
}
