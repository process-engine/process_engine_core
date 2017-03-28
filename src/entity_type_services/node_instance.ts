import { INodeInstanceEntityTypeService, IProcessDefEntity, BpmnDiagram, IParamImportFromFile, IParamImportFromXml, 
  IParamStart, IProcessEntity, IParamsContinueFromRemote } from '@process-engine-js/process_engine_contracts';
import { ExecutionContext, IPublicGetOptions, IQueryObject, IPrivateQueryOptions, IEntity, IEntityReference, IIamService, ICombinedQueryClause } from '@process-engine-js/core_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IDatastoreService, IEntityType } from '@process-engine-js/data_model_contracts';
import { IMessageBusService, IMessage } from '@process-engine-js/messagebus_contracts';
import { IFeatureService } from '@process-engine-js/feature_contracts';
import { IRoutingService } from '@process-engine-js/routing_contracts';

export class NodeInstanceEntityTypeService implements INodeInstanceEntityTypeService {

  private _datastoreService: IDatastoreService = undefined;
  private _messagebusService: IMessageBusService = undefined;
  private _iamService: IIamService = undefined;
  private _featureService: IFeatureService = undefined;
  private _routingService: IRoutingService = undefined;

  constructor(datastoreService: IDatastoreService, messagebusService: IMessageBusService, iamService: IIamService, featureService: IFeatureService, routingService: IRoutingService) {
    this._datastoreService = datastoreService;
    this._messagebusService = messagebusService;
    this._iamService = iamService;
    this._featureService = featureService;
    this._routingService = routingService;
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

  private get featureService(): IFeatureService {
    return this._featureService;
  }

  private get routingService(): IRoutingService {
    return this._routingService;
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

    const internalContext = await this.iamService.createInternalContext('processengine_system');
    const process = await source.getProcess(internalContext);
    let participant = source.participant;

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

    const currentDef = await source.getNodeDef(internalContext);
    const currentLane = await currentDef.getLane(internalContext);

    const nextLane = await nextDef.getLane(internalContext);
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

      
      const queryObj: IQueryObject = {
        operator: 'and',
        queries: [
        { attribute: 'process', operator: '=', value: process.id },
        { attribute: 'key', operator: '=', value: nextDef.key }
      ]};

      node = await entityType.findOne(internalContext, { query: queryObj });
    }

    if (node) {

      const data = {
        action: 'proceed',
        token: null
      };

      const msg = this.messagebusService.createEntityMessage(data, source, context);
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


  public async continueExecution(context: ExecutionContext, source: IEntity): Promise<void> {

    const flowDefEntityType = await this.datastoreService.getEntityType('FlowDef');
    const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
    const processTokenEntityType = await this.datastoreService.getEntityType('ProcessToken');

    const nodeInstance = <any>source;
    const splitToken = (nodeInstance.type === 'bpmn:ParallelGateway' && nodeInstance.parallelType === 'split') ? true : false;

    let nextDefs = null;
    const nodeDef = await nodeInstance.getNodeDef(context);
    const processDef = await nodeDef.getProcessDef(context);

    let flowsOut = null;

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

        flowsOut = await flowDefEntityType.query(context, { query: queryObjectFollow });
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

      flowsOut = await flowDefEntityType.query(context, { query: queryObjectAll });
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

      nextDefs = await nodeDefEntityType.query(context, { query: queryObjectIn });

      if (nextDefs && nextDefs.length > 0) {

        const processToken = await nodeInstance.getProcessToken(context);

        for (let i = 0; i < nextDefs.data.length; i++) {
          const nextDef = nextDefs.data[i];

          let currentToken;
          if (splitToken && i > 0) {
            currentToken = await processTokenEntityType.createEntity(context);
            currentToken.process = processToken.process;
            currentToken.data = processToken.data;
            await currentToken.save(context);
          } else {
            currentToken = processToken;
          }

          const lane = await nextDef.getLane(context);
          const processDef = await nextDef.getProcessDef(context);

          const nodeFeatures = nextDef.features;
          const laneFeatures = lane.features;
          const processFeatures = processDef.features;

          let features = [];
          if (nodeFeatures) {
            features = features.concat(nodeFeatures);
          }
          if (laneFeatures) {
            features = features.concat(laneFeatures);
          }
          if (processFeatures) {
            features = features.concat(processFeatures);
          }

          if (features.length === 0 || this.featureService.hasFeatures(features)) {
            await this.createNextNode(context, nodeInstance, nextDef, currentToken);
          } else {
            const appInstances = this.featureService.getApplicationInstanceIdsByFeatures(features);
            if (appInstances.length > 0) {
              const appInstanceId = appInstances[0];

              // Todo: set correct message format
              const data = {
                route: 'service/ProcessDef/continueFromRemote',
                params: {
                  source: nodeInstance.getEntityReference(),
                  nextDef: nextDef.getEntityReference(),
                  token: currentToken.getEntityReference()
                }
              };
              const message: IMessage = this.messagebusService.createEntityMessage(data, nextDef, context);
              await this.routingService.send(appInstanceId, message);
            }
            throw new Error('can not route, no matching instance found');
          }

          

        }
      }

    }
  
  }

  public async continueFromRemote(context: ExecutionContext, params: IParamsContinueFromRemote, options?: IPublicGetOptions): Promise<void> {

    // Todo: restore entities from references respecting namespaces
    const processTokenEntityType = await this.datastoreService.getEntityType('ProcessToken');
    const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');

    const sourceRef = params.source;
    const sourceEntityType = await this.datastoreService.getEntityType(sourceRef.type);
    const source = await sourceEntityType.getById(sourceRef.id, context);

    const tokenRef = params.token;
    const token = await processTokenEntityType.getById(tokenRef.id, context);

    const nextDefRef = params.nextDef;
    const nextDef = await nodeDefEntityType.getById(nextDefRef.id, context);
    await this.createNextNode(context, source, nextDef, token);
  }
}
