import {NodeInstanceEntity} from './node_instance';
import {ExecutionContext, SchemaAttributeType, IFactory, IInheritedSchema, IEntity} from '@process-engine-js/core_contracts';
import {IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {IExclusiveGatewayEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';

export class ExclusiveGatewayEntity extends NodeInstanceEntity implements IExclusiveGatewayEntity {

  static attributes: any = {
    follow: { type: 'object' }
  };

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<ExclusiveGatewayEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(propertyBagFactory, invoker, entityType, context, schema);
  }

  public initialize(derivedClassInstance: IEntity): void {
    const actualInstance = derivedClassInstance || this;
    super.initialize(actualInstance);
  }

  @schemaAttribute({ type: SchemaAttributeType.object })
  public get follow(): any {
    return this.getProperty(this, 'follow');
  }

  public set follow(value: any) {
    this.setProperty(this, 'follow', value);
  }

}
