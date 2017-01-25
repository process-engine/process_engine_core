import {IFactory, IInheritedSchema} from '@process-engine-js/core_contracts';
import {Entity, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {ExecutionContext} from '@process-engine-js/core_contracts';

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

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<LaneEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(propertyBagFactory, invoker, entityType, context, schema);
  }
  
}