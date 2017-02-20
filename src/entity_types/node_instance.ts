import {ExecutionContext, SchemaAttributeType, IFactory, IInheritedSchema, IEntity} from '@process-engine-js/core_contracts';
import {Entity, IEntityType, IPropertyBag, IEncryptionService, EntityReference} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {INodeInstanceEntity, INodeDefEntity, IProcessEntity, IProcessTokenEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute, schemaClass} from '@process-engine-js/metadata';


@schemaClass({
  expand: [
    {attribute: 'nodeDef', depth: 2},
    {attribute: 'processToken', depth: 2}
  ]
})
export class NodeInstanceEntity extends Entity implements INodeInstanceEntity {

  private _helper: any = undefined;

  constructor(nodeInstanceHelper: any, propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<INodeInstanceEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(propertyBagFactory, encryptionService, invoker, entityType, context, schema);

    this._helper = nodeInstanceHelper;
  }

  private get helper(): any {
    return this._helper;
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

  @schemaAttribute({ type: 'Process' })
  public get process(): IProcessEntity {
    return this.getProperty(this, 'process');
  }

  public set process(value: IProcessEntity) {
    this.setProperty(this, 'process', value);
  }

  public getProcess(): Promise<IProcessEntity> {
    return this.getPropertyLazy(this, 'process');
  }


  @schemaAttribute({ type: 'NodeDef' })
  public get nodeDef(): INodeDefEntity {
    return this.getProperty(this, 'nodeDef');
  }

  public set nodeDef(value: INodeDefEntity) {
    this.setProperty(this, 'nodeDef', value);
  }

  public getNodeDef(): Promise<INodeDefEntity> {
    return this.getPropertyLazy(this, 'nodeDef');
  }


  @schemaAttribute({ type: SchemaAttributeType.string })
  public get type(): string {
    return this.getProperty(this, 'type');
  }

  public set type(value: string) {
    this.setProperty(this, 'type', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get state(): string {
    return this.getProperty(this, 'state');
  }

  public set state(value: string) {
    this.setProperty(this, 'state', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get participant(): string {
    return this.getProperty(this, 'participant');
  }

  public set participant(value: string) {
    this.setProperty(this, 'participant', value);
  }


  @schemaAttribute({ type: 'ProcessToken' })
  public get processToken(): IProcessTokenEntity {
    return this.getProperty(this, 'processToken');
  }

  public set processToken(value: IProcessTokenEntity) {
    this.setProperty(this, 'processToken', value);
  }

  public getProcessToken(): Promise<IProcessTokenEntity> {
    return this.getPropertyLazy(this, 'processToken');
  }

  public async createNode(context) {

    async function nodeHandler(msg) {
      msg = await this.messagebus.verifyMessage(msg);

      const action = (msg && msg.data && msg.data.action) ? msg.data.action : null;
      const source = (msg && msg.origin) ? msg.origin : null;
      const context = (msg && msg.meta && msg.meta.context) ? msg.meta.context : {};

      if (action === 'changeState') {
        const newState = (msg && msg.data && msg.data.data) ? msg.data.data : null;

        switch (newState) {
          case ('start'):
            await this.entity.start(context, source);
            break;

          case ('execute'):
            await this.entity.execute(context);
            break;

          case ('end'):
            await this.entity.end(context);
            break;

          default:
          // error ???
        }


      }

      if (action === 'proceed') {
        const newData = (msg && msg.data && msg.data.token) ? msg.data.token : null;
        await this.entity.proceed(context, newData, source);
      }

      if (action === 'event') {
        const event = (msg && msg.data && msg.data.event) ? msg.data.event : null;
        const data = (msg && msg.data && msg.data.data) ? msg.data.data : null;
        await this.entity.event(context, event, data);
      }
    }

    const internalContext = await this.helper.iamService.createInternalContext('processengine_system');
    const NodeInstance = await this.helper.datastoreService.getEntityType('NodeInstance');
    const node = await NodeInstance.createEntity(internalContext);

    const binding = {
      entity: node,
      messagebus: this.helper.messagebusService
    };

    await this.helper.messagebusService.subscribe('/processengine/node/' + node.id, nodeHandler.bind(binding));

    return node;
  
  }


  public async getLaneRole(context: ExecutionContext) {
    const nodeDef = await this.nodeDef;
    const role = await nodeDef.getLaneRole(context);
    return role;
  }


  public async start(context: ExecutionContext, source: any): Promise<void> {
    // check if context matches to lane
    let role = await this.getLaneRole(context);
    if (role !== null) {
      // Todo: refactor check if user has lane role

      // const permissions = {
      //   'execute': [role]
      // };
      // await context.checkPermissions(this.id + '.execute', permissions);
    }

    if (!this.state) {
      this.state = 'start';
    }

    const internalContext = await this.helper.iamService.createInternalContext('processengine_system');
    await this.save(internalContext);

    await this.changeState(context, 'execute', this);
  }


  public async changeState(context: ExecutionContext, newState: string, source: any) {

    const meta = {
      jwt: context.encryptedToken
    };

    const data = {
      action: 'changeState',
      data: newState
    };

    // Todo: 
    const origin = new EntityReference(source.entityType.namespace, source.entityType.name, source.id);

    const msg = this.helper.messagebusService.createMessage(data, origin, meta);
    await this.helper.messagebusService.publish('/processengine/node/' + this.id, msg);
  }
}
