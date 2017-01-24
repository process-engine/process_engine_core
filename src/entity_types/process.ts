import {Entity, IEntityType, IPropertyBag, IFactory, ISchemas} from 'data_model_contracts';
import {IInvoker} from 'invocation_contracts';
import {ExecutionContext} from 'iam_contracts';

export class ProcessEntity extends Entity {

  static attributes: any = {
    name: { type: 'string' },
    key: { type: 'string' },
    processDef: { type: 'ProcessDef' }
  };

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<ProcessEntity>, context: ExecutionContext, schemas: ISchemas) {
    super(propertyBagFactory, invoker, entityType, context, schemas);
  }
}
