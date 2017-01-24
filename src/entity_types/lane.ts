import {Entity, IEntityType, IPropertyBag, IFactory, ISchemas} from 'data_model_contracts';
import {IInvoker} from 'invocation_contracts';
import {ExecutionContext} from 'iam_contracts';

export class LaneEntity extends Entity {

  static attributes: any = {
      name: { type: 'string' },
      key: { type: 'string' },
      extensions: { type: 'object' },
      processDef: { type: 'ProcessDef' }
  };

  // TODO: what does this exactly do?
  static datasources = [
      'processengine'
  ];

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<LaneEntity>, context: ExecutionContext, schemas: ISchemas) {
    super(propertyBagFactory, invoker, entityType, context, schemas);
  }
  
}