import {ExecutionContext, SchemaAttributeType, IFactory, IInheritedSchema, IEntity} from '@process-engine-js/core_contracts';
import {Entity, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {IProcessEntity, IProcessDefEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';

export class ProcessEntity extends Entity implements IProcessEntity {

  static attributes: any = {
    name: { type: 'string' },
    key: { type: 'string' },
    processDef: { type: 'ProcessDef' }
  };

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<IProcessEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(propertyBagFactory, invoker, entityType, context, schema);
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get name(): string {
    return this.getProperty(this, 'name');
  }

  public set name(value: string) {
    this.setProperty(this, 'name', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get key(): string {
    return this.getProperty(this, 'key');
  }

  public set key(value: string) {
    this.setProperty(this, 'key', value);
  }

  @schemaAttribute({ type: 'ProcessDef' })
  public getProcessDef(): Promise<IProcessDefEntity> {
    return this.getPropertyLazy(this, 'processDef');
  }

  public setProcessDef(value: IProcessDefEntity): void {
    this.setProperty(this, 'processDef', value);
  }

}
