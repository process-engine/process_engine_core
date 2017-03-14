import { ExecutionContext, SchemaAttributeType, IInheritedSchema, IEntity, ICombinedQueryClause, IIamService } from '@process-engine-js/core_contracts';
import { Entity, EntityDependencyHelper, EntityReference } from '@process-engine-js/data_model_contracts';
import { INodeInstanceEntity, INodeInstanceEntityTypeService, INodeDefEntity, IProcessEntity, IProcessTokenEntity } from '@process-engine-js/process_engine_contracts';
import { schemaAttribute, schemaClass } from '@process-engine-js/metadata';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';

export class NodeInstanceEntityDependencyHelper {
  
  public messageBusService: IMessageBusService = undefined;
  public iamService: IIamService = undefined;
  public nodeInstanceEntityTypeService: INodeInstanceEntityTypeService = undefined;

  constructor(messageBusService: IMessageBusService, iamService: IIamService, nodeInstanceEntityTypeService: INodeInstanceEntityTypeService) {
    this.messageBusService = messageBusService;
    this.iamService = iamService;
    this.nodeInstanceEntityTypeService = nodeInstanceEntityTypeService;
  }
}

// @schemaClass({
//   expandEntity: [
//     { attribute: 'nodeDef'},
//     { attribute: 'processToken'}
//   ]
// })
export class NodeInstanceEntity extends Entity implements INodeInstanceEntity {

  private _nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper = undefined;

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper,
              entityDependencyHelper: EntityDependencyHelper, 
              context: ExecutionContext,
              schema: IInheritedSchema) {
    super(entityDependencyHelper, context, schema);

    this._nodeInstanceEntityDependencyHelper = nodeInstanceEntityDependencyHelper;
  }

  protected get iamService(): IIamService {
    return this._nodeInstanceEntityDependencyHelper.iamService;
  }

  protected get messageBusService(): IMessageBusService {
    return this._nodeInstanceEntityDependencyHelper.messageBusService;
  }

  protected get nodeInstanceEntityTypeService(): INodeInstanceEntityTypeService {
    return this._nodeInstanceEntityDependencyHelper.nodeInstanceEntityTypeService;
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

  public getProcess(context: ExecutionContext): Promise<IProcessEntity> {
    return this.getPropertyLazy(this, 'process', context);
  }


  @schemaAttribute({ type: 'NodeDef' })
  public get nodeDef(): INodeDefEntity {
    return this.getProperty(this, 'nodeDef');
  }

  public set nodeDef(value: INodeDefEntity) {
    this.setProperty(this, 'nodeDef', value);
  }

  public getNodeDef(context: ExecutionContext): Promise<INodeDefEntity> {
    return this.getPropertyLazy(this, 'nodeDef', context);
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

  public getProcessToken(context: ExecutionContext): Promise<IProcessTokenEntity> {
    return this.getPropertyLazy(this, 'processToken', context);
  }

  public async getLaneRole(context: ExecutionContext): Promise<string> {
    const nodeDef = await this.getNodeDef(context);
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

    const internalContext = await this.iamService.createInternalContext('processengine_system');
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

    const msg = this.messageBusService.createMessage(data, origin, meta);
    await this.messageBusService.publish('/processengine/node/' + this.id, msg);
  }

  public async error(context: ExecutionContext, error: any): Promise<void> {
    const nodeDef = await this.getNodeDef(context);
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

      const msg = this.messageBusService.createMessage(data, origin, meta);
      await this.messageBusService.publish('/processengine/node/' + this.id, msg);
    }
  }


  public async execute(context: ExecutionContext): Promise<void> {
    const internalContext = await this.iamService.createInternalContext('processengine_system');

    this.state = 'progress';
    await this.save(internalContext);

    await this.changeState(context, 'end', this);
  }


  public async proceed(context: ExecutionContext, data: any, source: EntityReference) {
    // by default do nothing, implementation should be overwritten by child class
  }


  public async event(context: ExecutionContext, event: string, data: any) {

    const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
    const internalContext = await this.iamService.createInternalContext('processengine_system');

    // check if definition exists
    const nodeDef = await this.getNodeDef(internalContext);
    if (nodeDef && nodeDef.events && nodeDef.events[event]) {
      const boundaryDefKey = nodeDef.events[event];

      const queryObject = {
        attribute: 'key', operator: '=', value: boundaryDefKey
      };
      const boundary = <INodeDefEntity>await nodeDefEntityType.findOne(internalContext, { query: queryObject });

      const token = await this.getProcessToken(internalContext);

      if (boundary && boundary.cancelActivity) {
        await this.end(context, true);
      }
      await this.nodeInstanceEntityTypeService.createNextNode(context, this, boundary, token);
    }
  }


  public async cancel(context: ExecutionContext): Promise<void> {
    const nodeDef = await this.getNodeDef(context);
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

      const msg = this.messageBusService.createMessage(data, origin, meta);
      await this.messageBusService.publish('/processengine/node/' + this.id, msg);
    }
  }


  public async end(context: ExecutionContext, cancelFlow: boolean = false) {

    const flowDefEntityType = await this.datastoreService.getEntityType('FlowDef');
    const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
    const processTokenEntityType = await this.datastoreService.getEntityType('ProcessToken');

    const internalContext = await this.iamService.createInternalContext('processengine_system');

    this.state = 'end';

    await this.save(internalContext);
    const nodeInstance = this as any;
    const splitToken = (nodeInstance.type === 'bpmn:ParallelGateway' && nodeInstance.parallelType === 'split') ? true : false;

    const processToken = await this.getProcessToken(internalContext);
    const tokenData = processToken.data || {};
    tokenData.history = tokenData.history || {};
    tokenData.history[this.key] = tokenData.current;
    processToken.data = tokenData;

    await processToken.save(internalContext);

    let nextDefs = null;
    const nodeDef = await this.getNodeDef(internalContext);
    const processDef = await nodeDef.getProcessDef(internalContext);

    let flowsOut = null;

    if (!cancelFlow) {
      if (nodeInstance.follow) {
        // we have already a list of flows to follow
        if (nodeInstance.follow.length > 0) {

          const queryObjectFollow: ICombinedQueryClause = {
            operator: 'and',
            queries: [
              { attribute: 'id', operator: 'in', value: nodeInstance.follow },
              { attribute: 'processDef', operator: '=', value: processDef.id }
            ]
          };

          flowsOut = await flowDefEntityType.query(internalContext, { query: queryObjectFollow });
        }
      } else {
        // query for all flows going out
        const queryObjectAll: ICombinedQueryClause = {
          operator: 'and',
          queries: [
            { attribute: 'source', operator: '=', value: nodeDef.id },
            { attribute: 'processDef', operator: '=', value: processDef.id }
          ]
        };

        flowsOut = await flowDefEntityType.query(internalContext, { query: queryObjectAll });
      }
      if (flowsOut && flowsOut.length > 0) {
        const ids: Array<string> = [];
        for (let i = 0; i < flowsOut.data.length; i++) {
          const flow = flowsOut.data[i];
          const target = await flow.target;
          ids.push(target.id);
        }

        const queryObjectIn: ICombinedQueryClause = {
          operator: 'and',
          queries: [
            { attribute: 'id', operator: 'in', value: ids },
            { attribute: 'processDef', operator: '=', value: processDef.id }
          ]
        };

        nextDefs = await nodeDefEntityType.query(internalContext, { query: queryObjectIn });

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

            await this.nodeInstanceEntityTypeService.createNextNode(context, this, nextDef, currentToken);

          }
        }

      }
    }
  }
}
