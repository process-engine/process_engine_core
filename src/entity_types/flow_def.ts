import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema} from '@process-engine-js/core_contracts';
import {Entity, EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {IFlowDefEntity, IProcessDefEntity, INodeDefEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';

export class FlowDefEntity extends Entity implements IFlowDefEntity {

  constructor(entityDependencyHelper: EntityDependencyHelper, 
              context: ExecutionContext,
              schema: IInheritedSchema) {
    super(entityDependencyHelper, context, schema);
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
  public get processDef(): IProcessDefEntity {
    return this.getProperty(this, 'processDef');
  }

  public set processDef(value: IProcessDefEntity) {
    this.setProperty(this, 'processDef', value);
  }

  public getProcessDef(): Promise<IProcessDefEntity> {
    return this.getPropertyLazy(this, 'processDef');
  }


  @schemaAttribute({ type: 'NodeDef' })
  public get source(): INodeDefEntity {
    return this.getProperty(this, 'source');
  }

  public set source(value: INodeDefEntity) {
    this.setProperty(this, 'source', value);
  }

  public getSource(): Promise<INodeDefEntity> {
    return this.getPropertyLazy(this, 'source');
  }


  @schemaAttribute({ type: 'NodeDef' })
  public get target(): INodeDefEntity {
    return this.getProperty(this, 'target');
  }

  public set target(value: INodeDefEntity) {
    this.setProperty(this, 'target', value);
  }

  public getTarget(): Promise<INodeDefEntity> {
    return this.getPropertyLazy(this, 'target');
  }


  @schemaAttribute({ type: SchemaAttributeType.string })
  public get condition(): string {
    return this.getProperty(this, 'condition');
  }

  public set condition(value: string) {
    this.setProperty(this, 'condition', value);
  }

}
