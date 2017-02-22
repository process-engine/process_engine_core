import { ExecutionContext, SchemaAttributeType, IFactory, IInheritedSchema, IEntity } from '@process-engine-js/core_contracts';
import { Entity, IEntityType, IPropertyBag, IEncryptionService, EntityReference } from '@process-engine-js/data_model_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { INodeInstanceEntity, INodeDefEntity, IProcessEntity, IProcessTokenEntity, IParallelGatewayEntity } from '@process-engine-js/process_engine_contracts';
import { schemaAttribute, schemaClass } from '@process-engine-js/metadata';


@schemaClass({
  expand: [
    { attribute: 'nodeDef', depth: 2 },
    { attribute: 'processToken', depth: 2 }
  ]
})
export class NodeInstanceEntity extends Entity implements INodeInstanceEntity {

  private _helper: any = undefined;

  constructor(nodeInstanceHelper: any, propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<INodeInstanceEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(propertyBagFactory, encryptionService, invoker, entityType, context, schema);

    this._helper = nodeInstanceHelper;
  }

  public get helper(): any {
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


  public async getLaneRole(context: ExecutionContext) {
    const nodeDef = await this.getNodeDef();
    const role = await nodeDef.getLaneRole(context);
    return role;
  }


  public async start(context: ExecutionContext, source: IEntity): Promise<void> {
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


  public async changeState(context: ExecutionContext, newState: string, source: IEntity) {

    const meta = {
      jwt: context.encryptedToken
    };

    const data = {
      action: 'changeState',
      data: newState
    };

    // Todo: 
    const origin = source.getEntityReference();

    const msg = this.helper.messagebusService.createMessage(data, origin, meta);
    await this.helper.messagebusService.publish('/processengine/node/' + this.id, msg);
  }

  public async error(context: ExecutionContext, error: any): Promise<void> {
    const nodeDef = await this.getNodeDef();
    if (nodeDef && nodeDef.events && nodeDef.events.error) {

      const meta = {
        jwt: context.encryptedToken
      };

      const data = {
        action: 'event',
        event: 'error',
        data: error
      };

      const origin = this.getEntityReference();

      const msg = this.helper.messagebusService.createMessage(data, origin, meta);
      await this.helper.messagebusService.publish('/processengine/node/' + this.id, msg);
    }
  }


  public async execute(context: ExecutionContext): Promise<void> {
    const internalContext = await this.helper.iamService.createInternalContext('processengine_system');

    this.state = 'progress';
    await this.save(internalContext);

    await this.changeState(context, 'end', this);
  }


  public async proceed(context: ExecutionContext, data: any, source: EntityReference) {
    // by default do nothing, implementation should be overwritten by child class
  }


  public async event(context: ExecutionContext, event: string, data: any) {

    const nodeDefEntityType = await this.helper.datastoreService.getEntityType('NodeDef');
    const internalContext = await this.helper.iamService.createInternalContext('processengine_system');

    // check if definition exists
    const nodeDef = await this.getNodeDef();
    if (nodeDef && nodeDef.events && nodeDef.events[event]) {
      const boundaryDefKey = nodeDef.events[event];

      const queryObject = {
        attribute: 'key', operator: '=', value: boundaryDefKey
      };
      const boundary = await nodeDefEntityType.findOne(internalContext, { query: queryObject });

      const token = await this.getProcessToken();

      if (boundary && boundary.cancelActivity) {
        await this.end(context, true);
      }
      await this.helper.nodeInstanceEntityTypeService.createNextNode(context, this, boundary, token);
    }
  }


  public async cancel(context: ExecutionContext): Promise<void> {
    const nodeDef = await this.getNodeDef();
    if (nodeDef && nodeDef.events && nodeDef.events.cancel) {

      const meta = {
        jwt: context.encryptedToken
      };

      const data = {
        action: 'event',
        event: 'cancel',
        data: null
      };

      const origin = this.getEntityReference();

      const msg = this.helper.messagebusService.createMessage(data, origin, meta);
      await this.helper.messagebusService.publish('/processengine/node/' + this.id, msg);
    }
  }


  public async end(context: ExecutionContext, cancelFlow: boolean = false) {

    const flowDefEntityType = await this.helper.datastoreService.getEntityType('FlowDef');
    const nodeDefEntityType = await this.helper.datastoreService.getEntityType('NodeDef');
    const processTokenEntityType = await this.helper.datastoreService.getEntityType('ProcessToken');

    const internalContext = await this.helper.iamService.createInternalContext('processengine_system');

    this.state = 'end';

    await this.save(internalContext);
    const nodeInstance = this as any;
    const splitToken = (nodeInstance.type === 'bpmn:ParallelGateway' && nodeInstance.parallelType === 'split') ? true : false;

    const processToken = await this.getProcessToken();
    const tokenData = processToken.data || {};
    tokenData.history = tokenData.history || {};
    tokenData.history[this.key] = tokenData.current;
    processToken.data = tokenData;

    await processToken.save(internalContext);

    let nextDefs = null;
    const nodeDef = await this.getNodeDef();
    const processDef = await nodeDef.getProcessDef();

    let flowsOut = null;

    if (!cancelFlow) {
      if (nodeInstance.follow) {
        // we have already a list of flows to follow
        if (nodeInstance.follow.length > 0) {
          const queryIn = nodeInstance.follow.map((id) => {
            return { attribute: 'id', operator: '=', value: id };
          });
          flowsOut = await flowDefEntityType.query(internalContext, {
            query: [
              { or: queryIn },
              { attribute: 'processDef', operator: '=', value: processDef.id }
            ]
          });
        }
      } else {
        // query for all flows going out
        flowsOut = await flowDefEntityType.query(internalContext, {
          query: [
            { attribute: 'source', operator: '=', value: nodeDef.id },
            { attribute: 'processDef', operator: '=', value: processDef.id }
          ]
        });
      }
      if (flowsOut && flowsOut.length > 0) {
        const ids: Array<string> = [];
        for (let i = 0; i < flowsOut.data.length; i++) {
          const flow = flowsOut.data[i];
          const target = await flow.target;
          ids.push(target.id);
        }

        const queryIn = ids.map((id) => {
          return { attribute: 'id', operator: '=', value: id };
        });
        nextDefs = await nodeDefEntityType.query(internalContext, {
          query: [
            { or: queryIn },
            { attribute: 'processDef', operator: '=', value: processDef.id }
          ]
        });

        if (nextDefs && nextDefs.length > 0) {


          for (let i = 0; i < nextDefs.data.length; i++) {
            const nextDef = nextDefs.data[i];

            let currentToken;
            if (splitToken && i > 0) {
              currentToken = await processTokenEntityType.createEntity(internalContext);
              currentToken.process = processToken.process;
              currentToken.data = processToken.data;
              await currentToken.save(internalContext);
            } else {
              currentToken = processToken;
            }

            await this.helper.nodeInstanceEntityTypeService.createNextNode(context, this, nextDef, currentToken);

          }
        }

      }
    }
  }
}
