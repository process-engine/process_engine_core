import {ExecutionContext, IEntity, IInheritedSchema, IQueryClause, SchemaAttributeType} from '@process-engine-js/core_contracts';
import {Entity, EntityCollection, EntityDependencyHelper, IEntityType, IPropertyBag, IEntityCollection} from '@process-engine-js/data_model_contracts';
import { IFeature } from '@process-engine-js/feature_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {ILaneEntity, INodeDefEntity, IProcessDefEntity, TimerDefinitionType, IBoundaryEventEntity} from '@process-engine-js/process_engine_contracts';

export class NodeDefEntity extends Entity implements INodeDefEntity {

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

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get timerDefinition(): string {
    return this.getProperty(this, 'timerDefinition');
  }

  public set timerDefinition(value: string) {
    this.setProperty(this, 'timerDefinition', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get startContext(): string {
    return this.getProperty(this, 'startContext');
  }

  public set startContext(value: string) {
    this.setProperty(this, 'startContext', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get startContextEntityType(): string {
    return this.getProperty(this, 'startContextEntityType');
  }

  public set startContextEntityType(value: string) {
    this.setProperty(this, 'startContextEntityType', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get signal(): string {
    return this.getProperty(this, 'signal');
  }

  public set signal(value: string) {
    this.setProperty(this, 'signal', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get message(): string {
    return this.getProperty(this, 'message');
  }

  public set message(value: string) {
    this.setProperty(this, 'message', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get condition(): string {
    return this.getProperty(this, 'condition');
  }

  public set condition(value: string) {
    this.setProperty(this, 'condition', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get errorName(): string {
    return this.getProperty(this, 'errorName');
  }

  public set errorName(value: string) {
    this.setProperty(this, 'errorName', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get errorCode(): string {
    return this.getProperty(this, 'errorCode');
  }

  public set errorCode(value: string) {
    this.setProperty(this, 'errorCode', value);
  }

  public get features(): Array<IFeature> {
    return this._extractFeatures();
  }

  public async getLaneRole(context: ExecutionContext): Promise<string> {

    const lane = await this.getLane(context);
    return lane.role;
  }

  public async getBoundaryEvents(context: ExecutionContext): Promise<IEntityCollection<IBoundaryEventEntity>> {

    const nodeDefEntityType = await (await this.getDatastoreService()).getEntityType('NodeDef');

    const queryObject: IQueryClause = {
      attribute: 'attachedToNode',
      operator: '=',
      value: this.id,
    };

    const boundaryColl = await nodeDefEntityType.query(context, { query: queryObject });
    return boundaryColl as IEntityCollection<IBoundaryEventEntity>;
  }

  private _extractFeatures(): Array<IFeature> {
    let features;
    const extensions = this.extensions || null;
    const props = (extensions && extensions.properties) ? extensions.properties : null;

    if (props) {
      props.forEach((prop) => {
        if (prop.name === 'features') {
          features = JSON.parse(prop.value);
        }
      });
    }

    if (this.type === 'bpmn:UserTask') {
      features = features || [];
      (features as Array<{}>).push({ name: 'UI', value: true });
    }

    return features;
  }

  public get mapper(): any {
    return this._extractMapper();
  }

  private _extractMapper(): any {
    let mapper;
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

  public get persist(): boolean {
    return true;
  }
}
