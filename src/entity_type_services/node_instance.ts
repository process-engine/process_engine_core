import { INodeInstanceEntityTypeService, IProcessDefEntity, BpmnDiagram, IParamImportFromFile, IParamImportFromXml, IParamStart, IProcessEntity } from '@process-engine-js/process_engine_contracts';
import { ExecutionContext, IPublicGetOptions, IQueryObject, IPrivateQueryOptions, IEntity, IEntityReference } from '@process-engine-js/core_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IDatastoreService, IEntityType } from '@process-engine-js/data_model_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
import { IIamService } from '@process-engine-js/iam_contracts';

export class NodeInstanceEntityTypeService implements INodeInstanceEntityTypeService {

  private _datastoreService: IDatastoreService = undefined;
  private _messagebusService: IMessageBusService = undefined;
  private _iamService: IIamService = undefined;

  constructor(datastoreService: IDatastoreService, messagebusService: IMessageBusService, iamService: IIamService) {
    this._datastoreService = datastoreService;
    this._messagebusService = messagebusService;
    this._iamService = iamService;
  }

  private get datastoreService(): IDatastoreService {
    return this._datastoreService;
  }

  private get messagebusService(): IMessageBusService {
    return this._messagebusService;
  }

  private get iamService(): IIamService {
    return this._iamService;
  }


  public async createNode(context: ExecutionContext, entityType: IEntityType<IEntity>): Promise<IEntity> {

    async function nodeHandler(msg: any) {
      msg = await this.messagebus.verifyMessage(msg);

      const action = (msg && msg.data && msg.data.action) ? msg.data.action : null;
      const source: IEntityReference = (msg && msg.origin) ? msg.origin : null;
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

    const internalContext = await this.iamService.createInternalContext('processengine_system');
    const node = await entityType.createEntity(internalContext);

    const binding = {
      entity: node,
      messagebus: this.messagebusService
    };

    await this.messagebusService.subscribe('/processengine/node/' + node.id, nodeHandler.bind(binding));

    return node;

  }


  public async createNextNode(context: ExecutionContext, source: any, nextDef: any, token: any): Promise<void> {

    const process = await source.getProcess();
    let participant = source.participant;

    const internalContext = await this.iamService.createInternalContext('processengine_system');

    const forceCreateNode = (nextDef.type === 'bpmn:BoundaryEvent') ? true : false;

    const map = new Map();
    map.set('bpmn:UserTask', 'UserTask');
    map.set('bpmn:ExclusiveGateway', 'ExclusiveGateway');
    map.set('bpmn:ParallelGateway', 'ParallelGateway');
    map.set('bpmn:ServiceTask', 'ServiceTask');
    map.set('bpmn:StartEvent', 'StartEvent');
    map.set('bpmn:EndEvent', 'EndEvent');
    map.set('bpmn:ScriptTask', 'ScriptTask');
    map.set('bpmn:BoundaryEvent', 'BoundaryEvent');
    map.set('bpmn:CallActivity', 'SubProcessExternal');
    map.set('bpmn:SubProcess', 'SubProcessInternal');

    const className = map.get(nextDef.type);
    const entityType = await this.datastoreService.getEntityType(className);

    const currentDef = await source.getNodeDef();
    const currentLane = await currentDef.getLane();

    const nextLane = await nextDef.getLane();
    // check for lane change
    if (currentLane && nextLane && currentLane.id !== nextLane.id) {
      // if we have a new lane, create a temporary context with lane role

      const role = await nextDef.getLaneRole(internalContext);
      if (role) {
        // Todo: refactor lane change
        /*const identityContext = await context.createNewContext('identity');
        const tempUser = role + source.id;

        const identity = model._datastore._processengine.identity;
        await identity.addSystemUser(tempUser, { roles: [role] }, identityContext);

        const jwt = await identity.loginByToken(tempUser);
        // use new context of temporary lane user
        context = await identity.token.verifyToken(jwt);*/
        participant = null;
      }

    }

    let node = null;

    if (!forceCreateNode) {

      
      const queryObj = [
        { attribute: 'process', operator: '=', value: process.id },
        { attribute: 'key', operator: '=', value: nextDef.key }
      ];

      node = await entityType.findOne(internalContext, { query: queryObj });
    }

    if (node) {

      const meta = {
        jwt: context.encryptedToken
      };

      const data = {
        action: 'proceed',
        token: null
      };

      const origin = source.getEntityReference();

      const msg = this.messagebusService.createMessage(data, origin, meta);
      await this.messagebusService.publish('/processengine/node/' + node.id, msg);
    } else {
      node = await this.createNode(context, entityType);
      node.name = nextDef.name;
      node.key = nextDef.key;
      node.process = process;
      node.nodeDef = nextDef;
      node.type = nextDef.type;
      node.processToken = token;
      node.participant = participant;

      await node.save(internalContext);

      await node.changeState(context, 'start', source);
    }
  }
}
