import {IFactory, IInheritedSchema} from '@process-engine-js/core_contracts';
import {Entity, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {ExecutionContext} from '@process-engine-js/core_contracts';

export class NodeInstanceEntity extends Entity {

  static attributes: any = {
    name: { type: 'string' },
    key: { type: 'string' },
    process: { type: 'Process' },
    nodeDef: { type: 'NodeDef' },
    type: { type: 'string' },
    state: { type: 'string' },
    participant: { type: 'string' },
    processToken: { type: 'ProcessToken' }
  };

  static expand = [
    {attribute: 'nodeDef', depth: 2},
    {attribute: 'processToken', depth: 2}
  ];

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<NodeInstanceEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(propertyBagFactory, invoker, entityType, context, schema);
  }
}
