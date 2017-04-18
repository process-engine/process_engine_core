import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema, IQueryClause} from '@process-engine-js/core_contracts';
import {Entity, EntityDependencyHelper, EntityCollection} from '@process-engine-js/data_model_contracts';
import {TimerDefinitionType, INodeDefEntity, IProcessDefEntity, ILaneEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import { IFeature } from '@process-engine-js/feature_contracts';

export class NodeDefEntity extends Entity implements INodeDefEntity {

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

  public getProcessDef(context: ExecutionContext): Promise<IProcessDefEntity> {
    return this.getPropertyLazy(this, 'processDef', context);
  }

  @schemaAttribute({ type: 'Lane' })
  public get lane(): ILaneEntity {
    return this.getProperty(this, 'lane');
  }

  public set lane(value: ILaneEntity) {
    this.setProperty(this, 'lane', value);
  }

  public getLane(context: ExecutionContext): Promise<ILaneEntity> {
    return this.getPropertyLazy(this, 'lane', context);
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

  public getAttachedToNode(context: ExecutionContext): Promise<INodeDefEntity> {
    return this.getPropertyLazy(this, 'attachedToNode', context);
  }


  @schemaAttribute({ type: SchemaAttributeType.object })
  public get events(): any {
    return this.getProperty(this, 'events');
  }

  public set events(value: any) {
    this.setProperty(this, 'events', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get script(): string {
    return this.getProperty(this, 'script');
  }

  public set script(value: string) {
    this.setProperty(this, 'script', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get eventType(): string {
    return this.getProperty(this, 'eventType');
  }

  public set eventType(value: string) {
    this.setProperty(this, 'eventType', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.boolean })
  public get cancelActivity(): boolean {
    return this.getProperty(this, 'cancelActivity');
  }

  public set cancelActivity(value: boolean) {
    this.setProperty(this, 'cancelActivity', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get subProcessKey(): string {
    return this.getProperty(this, 'subProcessKey');
  }

  public set subProcessKey(value: string) {
    this.setProperty(this, 'subProcessKey', value);
  }


  @schemaAttribute({ type: 'NodeDef' })
  public get subProcessDef(): INodeDefEntity {
    return this.getProperty(this, 'subProcessDef');
  }

  public set subProcessDef(value: INodeDefEntity) {
    this.setProperty(this, 'subProcessDef', value);
  }

  public getSubProcessDef(context: ExecutionContext): Promise<INodeDefEntity> {
    return this.getPropertyLazy(this, 'subProcessDef', context);
  }

  @schemaAttribute({ type: SchemaAttributeType.number })
  public get counter(): number {
    return this.getProperty(this, 'counter');
  }

  public set counter(value: number) {
    this.setProperty(this, 'counter', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.number })
  public get timerDefinitionType(): TimerDefinitionType {
    return this.getProperty(this, 'timerDefinitionType');
  }

  public set timerDefinitionType(value: TimerDefinitionType) {
    this.setProperty(this, 'timerDefinitionType', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.object })
  public get timerDefinition(): any {
    return this.getProperty(this, 'timerDefinition');
  }

  public set timerDefinition(value: any) {
    this.setProperty(this, 'timerDefinition', value);
  }

  public get features(): Array<IFeature> {
    return this._extractFeatures();
  }

  public async getLaneRole(context: ExecutionContext): Promise<string> {

    const lane = await this.getLane(context);
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

  public async getBoundaryEvents(context: ExecutionContext): Promise<EntityCollection> {

    const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
    
    const queryObject: IQueryClause = {
      attribute: 'attachedToNode',
      operator: '=',
      value: this.id
    };

    const boundaryColl = await nodeDefEntityType.query(context, { query: queryObject });
    return boundaryColl;
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
