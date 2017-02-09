import {ExecutionContext, SchemaAttributeType, IFactory, IInheritedSchema, IEntity} from '@process-engine-js/core_contracts';
import {NodeInstanceEntity} from './node_instance';
import {Entity, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {IParallelGatewayEntity} from '@process-engine-js/process_engine_contracts';

export class ParallelGatewayEntity extends NodeInstanceEntity implements IParallelGatewayEntity {

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<IParallelGatewayEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(propertyBagFactory, invoker, entityType, context, schema);
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get parallelType(): string {
    return this.getProperty(this, 'parallelType');
  }

  public set parallelType(value: string) {
    this.setProperty(this, 'parallelType', value);
  }
}
