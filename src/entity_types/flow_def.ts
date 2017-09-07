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

  public async initEntity(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initEntity(actualInstance);
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

  public getProcessDef(context: ExecutionContext): Promise<IProcessDefEntity> {
    return this.getPropertyLazy(this, 'processDef', context);
  }

  @schemaAttribute({ type: 'NodeDef' })
  public get source(): INodeDefEntity {
    return this.getProperty(this, 'source');
  }

  public set source(value: INodeDefEntity) {
    this.setProperty(this, 'source', value);
  }

  public getSource(context: ExecutionContext): Promise<INodeDefEntity> {
    return this.getPropertyLazy(this, 'source', context);
  }

  @schemaAttribute({ type: 'NodeDef' })
  public get target(): INodeDefEntity {
    return this.getProperty(this, 'target');
  }

  public set target(value: INodeDefEntity) {
    this.setProperty(this, 'target', value);
  }

  public getTarget(context: ExecutionContext): Promise<INodeDefEntity> {
    return this.getPropertyLazy(this, 'target', context);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get condition(): string {
    return this.getProperty(this, 'condition');
  }

  public set condition(value: string) {
    this.setProperty(this, 'condition', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.object })
  public get extensions(): any {
    return this.getProperty(this, 'extensions');
  }

  public set extensions(value: any) {
    this.setProperty(this, 'extensions', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.number })
  public get counter(): number {
    return this.getProperty(this, 'counter');
  }

  public set counter(value: number) {
    this.setProperty(this, 'counter', value);
  }

  public get mapper(): any {
    return this._extractMapper();
  }

  private _extractMapper(): any {
    let mapper = undefined;
    const extensions = this.extensions || undefined;
    const props = (extensions !== undefined && extensions.properties) ? extensions.properties : undefined;

    if (props !== undefined) {
      props.forEach((prop) => {
        if (prop.name === 'mapper') {
          mapper = prop.value;
        }
      });
    }
    return mapper;
  }
}
