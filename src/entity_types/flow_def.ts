import {IFactory, IInheritedSchema} from '@process-engine-js/core_contracts';
import {Entity, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {ExecutionContext} from '@process-engine-js/core_contracts';

export class FlowDefEntity extends Entity {

  static attributes: any = {
      name: { type: 'string' },
      key: { type: 'string' },
      processDef: { type: 'ProcessDef' },
      source: { type: 'NodeDef' },
      target: { type: 'NodeDef' },
      condition: { type: 'string' }
  };

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<FlowDefEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(propertyBagFactory, invoker, entityType, context, schema);
  }
  
}