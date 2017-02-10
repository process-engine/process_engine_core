import {ExecutionContext, SchemaAttributeType, IFactory, IInheritedSchema, IEntity} from '@process-engine-js/core_contracts';
import {Entity, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {INodeDefEntity, IProcessDefEntity, ILaneEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';

export class NodeDefEntity extends Entity implements INodeDefEntity {

  constructor(propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<INodeDefEntity>, context: ExecutionContext, schema: IInheritedSchema) {
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
  public get processDef(): IProcessDefEntity {
    return this.getProperty(this, 'processDef');
  }

  public set processDef(value: IProcessDefEntity) {
    this.setProperty(this, 'processDef', value);
  }

  public getProcessDef(): Promise<IProcessDefEntity> {
    return this.getPropertyLazy(this, 'processDef');
  }

  @schemaAttribute({ type: 'Lane' })
  public get lane(): ILaneEntity {
    return this.getProperty(this, 'lane');
  }

  public set lane(value: ILaneEntity) {
    this.setProperty(this, 'lane', value);
  }

  public getLane(): Promise<ILaneEntity> {
    return this.getPropertyLazy(this, 'lane');
  }


  @schemaAttribute({ type: SchemaAttributeType.string })
  public get type(): string {
    return this.getProperty(this, 'type');
  }

  public set type(value: string) {
    this.setProperty(this, 'type', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.object })
  public get extensions(): any {
    return this.getProperty(this, 'extensions');
  }

  public set extensions(value: any) {
    this.setProperty(this, 'extensions', value);
  }

  @schemaAttribute({ type: 'NodeDef' })
  public get attachedToNode(): INodeDefEntity {
    return this.getProperty(this, 'attachedToNode');
  }

  public set attachedToNode(value: INodeDefEntity) {
    this.setProperty(this, 'attachedToNode', value);
  }

  public getAttachedToNode(): Promise<INodeDefEntity> {
    return this.getPropertyLazy(this, 'attachedToNode');
  }


  @schemaAttribute({ type: SchemaAttributeType.string })
  public get events(): string {
    return this.getProperty(this, 'events');
  }

  public set events(value: string) {
    this.setProperty(this, 'events', value);
  }

  public async getLaneRole(context: ExecutionContext): Promise<string> {

    const lane = await this.getLane();
    const extensions = lane.extensions;
    const properties = (extensions && extensions.properties) ? extensions.properties : null;

    let found = null;

    if (properties) {
      properties.some((property) => {
        if (property.name === 'role') {
          found = property.value;
          return true;
        }
      });
    }

    return found;
  }

    /*getBoundaryEvents: {
      fn: async function(context) {
        const model = this._dataClass.model;
        const queryObject = [
              { attribute: 'attachedToNode.id', operator: '=', value: this.id}
            ];
        const boundaryColl = await model.NodeDef.query({ query: queryObject }, null, context);
        return boundaryColl;
      }
    }*/

}
