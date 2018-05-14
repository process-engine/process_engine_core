import {ExecutionContext, IEntity, IInheritedSchema, IQueryClause, SchemaAttributeType} from '@essential-projects/core_contracts';
import {
  Entity,
  EntityCollection,
  EntityDependencyHelper,
  IEntityCollection,
  IEntityType,
  IPropertyBag,
} from '@essential-projects/data_model_contracts';
import {schemaAttribute} from '@essential-projects/metadata';
import {
} from '@process-engine/process_engine_contracts';

export class ProcessEntity extends Entity {

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

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get name(): string {
    return this.getProperty(this, 'name');
  }

  public set name(value: string) {
    this.setProperty(this, 'name', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.boolean })
  public get isExecutable(): string {
    return this.getProperty(this, 'isExecutable');
  }

  public set isExecutable(value: string) {
    this.setProperty(this, 'isExecutable', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get processId(): string {
    return this.getProperty(this, 'processId');
  }

  public set processId(value: string) {
    this.setProperty(this, 'processId', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.object })
  public get process(): string {
    return this.getProperty(this, 'process');
  }

  public set process(value: string) {
    this.setProperty(this, 'process', value);
  }

}
