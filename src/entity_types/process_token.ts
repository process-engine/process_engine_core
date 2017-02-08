import {ExecutionContext, SchemaAttributeType, IFactory, IInheritedSchema, IEntity} from '@process-engine-js/core_contracts';
import {Entity, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {IProcessTokenEntity, IProcessEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';

export class ProcessTokenEntity extends Entity implements IProcessTokenEntity {
  
  static attributes: any = {
    data: { type: 'object' },
    process: { type: 'Process' }
  };

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<IProcessTokenEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(propertyBagFactory, invoker, entityType, context, schema);
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  @schemaAttribute({ type: SchemaAttributeType.object })
  public get data(): any {
    return this.getProperty(this, 'data');
  }

  public set data(value: any) {
    this.setProperty(this, 'data', value);
  }

  @schemaAttribute({ type: 'Process' })
  public getProcess(): Promise<IProcessEntity> {
    return this.getPropertyLazy(this, 'process');
  }

  public setProcess(value: IProcessEntity): void {
    this.setProperty(this, 'process', value);
  }

}
