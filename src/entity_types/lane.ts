import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema} from '@process-engine-js/core_contracts';
import {Entity, EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {ILaneEntity, IProcessDefEntity} from '@process-engine-js/process_engine_contracts';
import {IFeature} from '@process-engine-js/feature_contracts';

export class LaneEntity extends Entity implements ILaneEntity {

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

  @schemaAttribute({ type: SchemaAttributeType.object })
  public get extensions(): any {
    return this.getProperty(this, 'extensions');
  }

  public set extensions(value: any) {
    this.setProperty(this, 'extensions', value);
  }

  @schemaAttribute({ type: 'ProcessDef' })
  public get processDef(): any {
    return this.getProperty(this, 'processDef');
  }

  public set processDef(value: any) {
    this.setProperty(this, 'processDef', value);
  }

  public getProcessDef(context: ExecutionContext): Promise<IProcessDefEntity> {
    return this.getPropertyLazy(this, 'processDef', context);
  }

  @schemaAttribute({ type: SchemaAttributeType.number })
  public get counter(): number {
    return this.getProperty(this, 'counter');
  }

  public set counter(value: number) {
    this.setProperty(this, 'counter', value);
  }
  
  public get features(): Array<IFeature> {
    return this._extractFeatures();
  }

  private _extractFeatures(): Array<IFeature> {
    let features = undefined;
    const extensions = this.extensions || null;
    const props = (extensions && extensions.properties) ? extensions.properties : null;

    if (props) {
      props.forEach((prop) => {
        if (prop.name === 'features') {
          features = JSON.parse(prop.value);
        }
      });
    }
    return features;
  }
}
