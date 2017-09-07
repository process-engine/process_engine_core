import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema} from '@process-engine-js/core_contracts';
import {Entity, EntityDependencyHelper, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {IProcessTokenEntity, IProcessEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';

export class ProcessTokenEntity extends Entity implements IProcessTokenEntity {

  constructor(entityDependencyHelper: EntityDependencyHelper,
              context: ExecutionContext,
              schema: IInheritedSchema,
              propertyBag: IPropertyBag,
              entityType: IEntityType<IEntity>) {
    super(entityDependencyHelper, context, schema, propertyBag, entityType);
  }

  public async initialize(): Promise<void> {
    await super.initialize(this);
  }

  @schemaAttribute({ type: SchemaAttributeType.object })
  public get data(): any {
    return this.getProperty(this, 'data');
  }

  public set data(value: any) {
    this.setProperty(this, 'data', value);
  }

  @schemaAttribute({ type: 'Process' })
  public get process(): IProcessEntity {
    return this.getProperty(this, 'process');
  }

  public set process(value: IProcessEntity) {
    this.setProperty(this, 'process', value);
  }

  public getProcess(context: ExecutionContext): Promise<IProcessEntity> {
    return this.getPropertyLazy(this, 'process', context);
  }

}
