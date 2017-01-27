import {ExecutionContext, SchemaAttributeType, IFactory, IInheritedSchema, IEntity} from '@process-engine-js/core_contracts';
import {Entity, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {IFlowDefEntity, IProcessDefEntity, INodeDefEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';

export class FlowDefEntity extends Entity implements IFlowDefEntity {

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

  public initialize(derivedClassInstance: IEntity): void {
    const actualInstance = derivedClassInstance || this;
    super.initialize(actualInstance);
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

  @schemaAttribute({ type: 'NodeDef' })
  public getSource(): Promise<INodeDefEntity> {
    return this.getPropertyLazy(this, 'source');
  }

  public setSource(value: INodeDefEntity): void {
    this.setProperty(this, 'source', value);
  }

  @schemaAttribute({ type: 'NodeDef' })
  public getTarget(): Promise<INodeDefEntity> {
    return this.getPropertyLazy(this, 'target');
  }

  public setTarget(value: INodeDefEntity): void {
    this.setProperty(this, 'source', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get condition(): string {
    return this.getProperty(this, 'condition');
  }

  public set condition(value: string) {
    this.setProperty(this, 'condition', value);
  }

}