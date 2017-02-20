import {NodeInstanceEntity} from './node_instance';
import {ExecutionContext, SchemaAttributeType, IFactory, IInheritedSchema, IEntity} from '@process-engine-js/core_contracts';
import {IEntityType, IPropertyBag, IEncryptionService} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {IExclusiveGatewayEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';

export class ExclusiveGatewayEntity extends NodeInstanceEntity implements IExclusiveGatewayEntity {

  constructor(nodeInstanceHelper: any, propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<IExclusiveGatewayEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(nodeInstanceHelper, propertyBagFactory, encryptionService, invoker, entityType, context, schema);
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  @schemaAttribute({ type: SchemaAttributeType.object })
  public get follow(): any {
    return this.getProperty(this, 'follow');
  }

  public set follow(value: any) {
    this.setProperty(this, 'follow', value);
  }

}
