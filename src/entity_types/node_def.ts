import {ExecutionContext, SchemaAttributeType, IFactory, IInheritedSchema, IEntity} from '@process-engine-js/core_contracts';
import {Entity, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {INodeDefEntity, IProcessDefEntity, ILaneEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';

export class NodeDefEntity extends Entity implements INodeDefEntity {

  static attributes: any = {
      name: { type: 'string' },
      key: { type: 'string' },
      processDef: { type: 'ProcessDef' },
      lane: { type: 'Lane' },
      type: { type: 'string' },
      extensions: { type: 'object' },
      attachedToNode: { type: 'NodeDef'},
      events: { type: 'object' }
  };

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
  public getProcessDef(): Promise<IProcessDefEntity> {
    return this.getPropertyLazy(this, 'processDef');
  }

  public setProcessDef(value: IProcessDefEntity): void {
    this.setProperty(this, 'processDef', value);
  }

  @schemaAttribute({ type: 'Lane' })
  public getLane(): Promise<ILaneEntity> {
    return this.getPropertyLazy(this, 'lane');
  }

  public setLane(value: ILaneEntity): void {
    this.setProperty(this, 'lane', value);
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
  public getAttachedToNode(): Promise<INodeDefEntity> {
    return this.getPropertyLazy(this, 'attachedToNode');
  }

  public setAttachedToNode(value: INodeDefEntity): void {
    this.setProperty(this, 'attachedToNode', value);
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
