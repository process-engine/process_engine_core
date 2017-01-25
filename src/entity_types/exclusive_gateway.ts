import {NodeInstanceEntity} from './node_instance';
import {IFactory, IInheritedSchema} from '@process-engine-js/core_contracts';
import {IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {ExecutionContext} from '@process-engine-js/core_contracts';

export class ExclusiveGatewayEntity extends NodeInstanceEntity {

  static attributes: any = {
    follow: { type: 'object' }
  };

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<ExclusiveGatewayEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(propertyBagFactory, invoker, entityType, context, schema);
  }

}
