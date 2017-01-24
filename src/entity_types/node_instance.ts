import {Entity, IEntityType, IPropertyBag, IFactory, ISchemas} from 'data_model_contracts';
import {IInvoker} from 'invocation_contracts';
import {ExecutionContext} from 'iam_contracts';

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

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<NodeInstanceEntity>, context: ExecutionContext, schemas: ISchemas) {
    super(propertyBagFactory, invoker, entityType, context, schemas);
  }
}
