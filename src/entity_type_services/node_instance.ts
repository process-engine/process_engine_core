import { INodeInstanceEntityTypeService, IProcessDefEntity, BpmnDiagram, IParamImportFromFile, IParamImportFromXml, 
  IParamStart, IProcessEntity, IParamsContinueFromRemote, INodeDefEntity, INodeInstanceEntity, IFlowDefEntity, ILaneEntity } from '@process-engine-js/process_engine_contracts';
import { ExecutionContext, IPublicGetOptions, IQueryObject, IPrivateQueryOptions, IEntity, IEntityReference, IIamService, ICombinedQueryClause, IFactory } from '@process-engine-js/core_contracts';
import { IInvoker } from '@process-engine-js/invocation_contracts';
import { IDatastoreService, IEntityType, EntityReference } from '@process-engine-js/data_model_contracts';
import { IMessageBusService, IMessage, IDatastoreMessageOptions, IDatastoreMessage } from '@process-engine-js/messagebus_contracts';
import { IFeatureService } from '@process-engine-js/feature_contracts';
import { IRoutingService } from '@process-engine-js/routing_contracts';
import { IEventAggregator } from '@process-engine-js/event_aggregator_contracts';

import * as debug from 'debug';
const debugInfo = debug('processengine:info');
const debugErr = debug('processengine:error');

interface Binding {
  eventAggregator: IEventAggregator;
  messagebusService: IMessageBusService;
  entity: any;
  datastoreService: IDatastoreService;
}

interface BindingMessagebus {
  messagebusService: IMessageBusService;
  entity: any;
}

export class NodeInstanceEntityTypeService implements INodeInstanceEntityTypeService {

  private _datastoreService: IDatastoreService = undefined;
  private _datastoreServiceFactory: IFactory<IDatastoreService> = undefined;
  private _messagebusService: IMessageBusService = undefined;
  private _eventAggregator: IEventAggregator = undefined;
  private _iamService: IIamService = undefined;
  private _featureService: IFeatureService = undefined;
  private _routingService: IRoutingService = undefined;

  constructor(datastoreServiceFactory: IFactory<IDatastoreService>, messagebusService: IMessageBusService, iamService: IIamService, eventAggregator: IEventAggregator, featureService: IFeatureService, routingService: IRoutingService) {
    this._datastoreServiceFactory = datastoreServiceFactory;
    this._messagebusService = messagebusService;
    this._eventAggregator = eventAggregator;
    this._iamService = iamService;
    this._featureService = featureService;
    this._routingService = routingService;
  }

  private get datastoreService(): IDatastoreService {
    if (!this._datastoreService) {
      this._datastoreService = this._datastoreServiceFactory();
    }
    return this._datastoreService;
  }

  private get messagebusService(): IMessageBusService {
    return this._messagebusService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
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

  private async _nodeHandler(event: any): Promise<void> {
    const binding: Binding = <any>this;

    const action = (event && event.data && event.data.action) ? event.data.action : null;
    const source: IEntity = (event && event.source) ? event.source : null;
    const context = (event && event.metadata && event.metadata.context) ? event.metadata.context : {};
    const applicationId = (event && event.metadata && event.metadata.applicationId) ? event.metadata.applicationId : null;

    if (action === 'changeState') {
      const newState = (event && event.data && event.data.data) ? event.data.data : null;

      switch (newState) {
          case ('start'):
              await binding.entity.start(context, source);
              break;

          case ('execute'):
              await binding.entity.execute(context);
              break;

          case ('end'):
              await binding.entity.end(context);
              break;

          default:
          // error ???
      }


    }

    if (action === 'proceed') {
      const newData = (event && event.data && event.data.token) ? event.data.token : null;
      await binding.entity.proceed(context, newData, source, applicationId);
    }

    if (action === 'event') {
      const nodeEvent = (event && event.data && event.data.event) ? event.data.event : null;
      const data = (event && event.data && event.data.data) ? event.data.data : null;
      await binding.entity.event(context, nodeEvent, data, source, applicationId);
    }
  }

  private async _nodeHandlerMessagebus(msg: any): Promise<void> {
    const binding: Binding = <any>this;

    await binding.messagebusService.verifyMessage(msg);

    const context = (msg && msg.metadata && msg.metadata.context) ? msg.metadata.context : {};

    const sourceRef = (msg && msg.source) ? msg.source : null;
    let source = null;
    if (sourceRef) {
      const entityType = await binding.datastoreService.getEntityType(sourceRef._meta.type);
      source = await entityType.getById(sourceRef.id, context);
    }
    
    const data: any = (msg && msg.data) ? msg.data : null;
    const event = binding.eventAggregator.createEntityEvent(data, source, context);
    binding.eventAggregator.publish('/processengine/node/' + binding.entity.id, event);
  }

  public async createNode(context: ExecutionContext, entityType: IEntityType<IEntity>): Promise<IEntity> {

    const internalContext = await this.iamService.createInternalContext('processengine_system');
    const node = await entityType.createEntity(internalContext);

    const binding: Binding = {
      entity: node,
      eventAggregator: this.eventAggregator,
      messagebusService: this.messagebusService,
      datastoreService: this.datastoreService
    };

    const anyNode = <any>node;
    anyNode.eventAggregatorSubscription = this.eventAggregator.subscribe('/processengine/node/' + node.id, this._nodeHandler.bind(binding));
    anyNode.messagebusSubscription = this.messagebusService.subscribe('/processengine/node/' + node.id, this._nodeHandlerMessagebus.bind(binding));
    return anyNode;

  }


  public async createNextNode(context: ExecutionContext, source: any, nextDef: any, token: any): Promise<void> {

    const internalContext = await this.iamService.createInternalContext('processengine_system');

    // const process = await source.getProcess(internalContext);
    const process = source.process;

    let participant = source.participant;

    const map = new Map();
    map.set('bpmn:UserTask', 'UserTask');
    map.set('bpmn:ExclusiveGateway', 'ExclusiveGateway');
    map.set('bpmn:ParallelGateway', 'ParallelGateway');
    map.set('bpmn:ServiceTask', 'ServiceTask');
    map.set('bpmn:StartEvent', 'StartEvent');
    map.set('bpmn:EndEvent', 'EndEvent');
    map.set('bpmn:IntermediateCatchEvent', 'CatchEvent');
    map.set('bpmn:IntermediateThrowEvent', 'ThrowEvent');
    map.set('bpmn:ScriptTask', 'ScriptTask');
    map.set('bpmn:BoundaryEvent', 'BoundaryEvent');
    map.set('bpmn:CallActivity', 'SubprocessExternal');
    map.set('bpmn:SubProcess', 'SubprocessInternal');

    const className = map.get(nextDef.type);
    const entityType = await this.datastoreService.getEntityType(className);

    // const currentDef = await source.getNodeDef(internalContext);
    const currentDef = source.nodeDef;

    const currentLane = currentDef.lane;

    const nextLane = nextDef.lane;
    // check for lane change
    if (currentLane && nextLane && currentLane.id !== nextLane.id) {
      // if we have a new lane, create a temporary context with lane role

      const role = await nextDef.lane.role;
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
    let createNode = true;

    Object.keys(process.activeInstances).forEach((instanceId) => {
      const instance = process.activeInstances[instanceId];
      if (instance.key === nextDef.key) {
        node = instance;
      }
    });


    let count = 0;
    if (token.data && token.data.history && token.data.history.hasOwnProperty(nextDef.key)) {
      if (Array.isArray(token.data.history[nextDef.key])) {
        count = token.data.history[nextDef.key].length;
      } else {
        count = 1;
      }
    }
    
    if (nextDef.type === 'bpmn:ParallelGateway' && node && node.state === 'progress') {

      if (node) {
        const data = {
          action: 'proceed',
          token: null
        };

        const event = this.eventAggregator.createEntityEvent(data, source, context);
        this.eventAggregator.publish('/processengine/node/' + node.id, event);

        createNode = false;
      }
    }

    if (createNode) {
      node = await this.createNode(context, entityType);
      node.name = nextDef.name;
      node.key = nextDef.key;
      node.process = process;
      node.nodeDef = nextDef;
      node.type = nextDef.type;
      node.processToken = token;
      node.participant = participant;
      node.instanceCounter = count;

      if (nextDef.type === 'bpmn:BoundaryEvent') {
        node.attachedToInstance = source;
      }

      // await node.save(internalContext);

      debugInfo(`node created key '${node.key}'`);

      node.changeState(context, 'start', source);
    }
  }


  public async continueExecution(context: ExecutionContext, source: IEntity): Promise<void> {
    const internalContext = await this.iamService.createInternalContext('processengine_system');

    // const flowDefEntityType = await this.datastoreService.getEntityType('FlowDef');
    // const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
    const processTokenEntityType = await this.datastoreService.getEntityType('ProcessToken');

    const nodeInstance = <any>source;
    const splitToken = (nodeInstance.type === 'bpmn:ParallelGateway' && nodeInstance.parallelType === 'split') ? true : false;

    let nextDefs = [];

    // const nodeDef = await nodeInstance.getNodeDef(internalContext);
    const nodeDef = nodeInstance.nodeDef;

    // const processDef = await nodeDef.getProcessDef(internalContext);
    const processDef = (<INodeInstanceEntity>source).process.processDef;

    let flowsOut = [];

    if (nodeInstance.follow) {
      // we have already a list of flows to follow
      if (nodeInstance.follow.length > 0) {

        for (let i = 0; i < processDef.flowDefCollection.data.length; i++) {
          const flowDef = <IFlowDefEntity>processDef.flowDefCollection.data[i];
          if (nodeInstance.follow.indexOf(flowDef.id) !== -1) {
            flowsOut.push(flowDef);
          }
        }
      }
    } else {

      for (let i = 0; i < processDef.flowDefCollection.data.length; i++) {
        const flowDef = <IFlowDefEntity>processDef.flowDefCollection.data[i];
        if (flowDef.source.id === nodeDef.id) {
          flowsOut.push(flowDef);
        }
      }
    }
    if (flowsOut && flowsOut.length > 0) {
      const ids: Array<string> = [];
      const mappers: Array<any> = [];

      for (let i = 0; i < flowsOut.length; i++) {
        const flow = flowsOut[i];
        const target = flow.target;
        ids.push(target.id);
        mappers.push(flow.mapper);
      }

      await (<INodeInstanceEntity>source).process.processDef.nodeDefCollection.each(internalContext, async (nodeDef) => {
        if (ids.indexOf(nodeDef.id) !== -1 && nodeDef.processDef.id === processDef.id) {
          nextDefs.push(nodeDef);
        }
      });

      if (nextDefs.length > 0) {

        // const processToken = await nodeInstance.getProcessToken(internalContext);
        const processToken = nodeInstance.processToken;

        for (let i = 0; i < nextDefs.length; i++) {
          const nextDef = nextDefs[i];

          let currentToken;

          const index = ids.indexOf(nextDef.id);
          const mapper = (index !== -1) ? mappers[index] : undefined;

          if (mapper !== undefined) {
            const tokenData = processToken.data || {};

            const newCurrent = (new Function('token', 'return ' + mapper)).call(tokenData, tokenData);
            tokenData.current = newCurrent;
            processToken.data = tokenData;

            // await processToken.save(internalContext);
          }

          if (splitToken && i > 0) {
            currentToken = await processTokenEntityType.createEntity(internalContext);
            currentToken.process = processToken.process;
            currentToken.data = processToken.data;
            // await currentToken.save(internalContext);
          } else {
            currentToken = processToken;
          }

          const laneRef = await nextDef.lane;
          const laneId = laneRef ? laneRef.id : undefined;
          let laneFeatures = undefined;
          for (let j = 0; j < processDef.laneCollection.data.length; j++) {
            const lane = <ILaneEntity>processDef.laneCollection.data[j];
            if (lane.id === laneId) {
              laneFeatures = lane.features;
            }
          }

          const nodeFeatures = nextDef.features;
          const processFeatures = processDef.features;

          const features = this.featureService.mergeFeatures(nodeFeatures, laneFeatures, processFeatures);

          if (features.length === 0 || this.featureService.hasFeatures(features)) {
            debugInfo(`continue in same thread with next node key ${nextDef.key}, features: ${JSON.stringify(features)}`);
            await this.createNextNode(context, nodeInstance, nextDef, currentToken);
          } else {
            const appInstances = this.featureService.getApplicationIdsByFeatures(features);

            if (appInstances.length === 0) {
              debugErr(`can not route to next node key '${nextDef.key }', features: ${JSON.stringify(features)}, no matching instance found`);
              throw new Error('can not route, no matching instance found');
            }

            const appInstanceId = appInstances[0];

            debugInfo(`continue on application '${appInstanceId}' with next node key '${nextDef.key}', features: ${JSON.stringify(features)}`);

            // Todo: set correct message format
            const options: IDatastoreMessageOptions = {
              action: 'POST',
              typeName: 'NodeInstance',
              method: 'continueFromRemote'
            };
            const data = {
              source: nodeInstance.getEntityReference().toPojo(),
              nextDef: nextDef.getEntityReference().toPojo(),
              token: currentToken.getEntityReference().toPojo()
            };
            const message: IDatastoreMessage = this.messagebusService.createDatastoreMessage(options, context, data);
            try {
              const result = await this.routingService.request(appInstanceId, message);
            } catch (err) {
              debugErr(`can not route to next node key '${nextDef.key}', features: ${JSON.stringify(features)}, error: ${err.message}`);

              // look for boundary error event
              if (nextDef && nextDef.events && nextDef.events.error) {

                const boundaryDefKey = nextDef.events.error;

                const queryObject = {
                  attribute: 'key', operator: '=', value: boundaryDefKey
                };
                const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
                const boundary = <INodeDefEntity>await nodeDefEntityType.findOne(internalContext, { query: queryObject });

                // continue with boundary
                await this.createNextNode(context, nodeInstance, boundary, currentToken);

              } else {
                // bubble error 
                throw err;
              }
            }
          }

        }
      }

    }
  
  }

  public async continueFromRemote(context: ExecutionContext, params: IParamsContinueFromRemote, options?: IPublicGetOptions): Promise<void> {

    let source = undefined;
    let token = undefined;
    let nextDef = undefined;

    // Todo: restore entities from references respecting namespaces
    const processTokenEntityType = await this.datastoreService.getEntityType('ProcessToken');
    const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');

    const sourceRef = new EntityReference(params.source._meta.namespace, params.source._meta.type, params.source.id);
    const sourceEntityType = await this.datastoreService.getEntityType(sourceRef.type);
    if (sourceEntityType && sourceRef.id) {
      source = await sourceEntityType.getById(sourceRef.id, context);
    }

    const tokenRef = new EntityReference(params.token._meta.namespace, params.token._meta.type, params.token.id);
    token = await processTokenEntityType.getById(tokenRef.id, context);

    const nextDefRef = new EntityReference(params.nextDef._meta.namespace, params.nextDef._meta.type, params.nextDef.id);
    nextDef = await nodeDefEntityType.getById(nextDefRef.id, context);

    if (source && token && nextDef) {
      await this.createNextNode(context, source, nextDef, token);
    } else {
      throw new Error('param is missing');
    }
  }
}
