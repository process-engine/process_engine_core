import { ExecutionContext, IEntity, IIamService, IPublicGetOptions } from '@process-engine-js/core_contracts';
import {EntityReference, IDatastoreService, IEntityType} from '@process-engine-js/data_model_contracts';
import { IEventAggregator } from '@process-engine-js/event_aggregator_contracts';
import { IFeatureService } from '@process-engine-js/feature_contracts';
import { IDatastoreMessage, IDatastoreMessageOptions, IMessageBusService } from '@process-engine-js/messagebus_contracts';
import { IFlowDefEntity, ILaneEntity, INodeDefEntity, INodeInstanceEntity, INodeInstanceEntityTypeService,
  IParamsContinueFromRemote, IProcessEngineService, IProcessEntity } from '@process-engine-js/process_engine_contracts';
import { IRoutingService } from '@process-engine-js/routing_contracts';

import * as debug from 'debug';

import {NodeDefEntity} from '../entity_types/node_def';
import {ProcessTokenEntity} from '../entity_types/process_token';

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
  private _messagebusService: IMessageBusService = undefined;
  private _eventAggregator: IEventAggregator = undefined;
  private _iamService: IIamService = undefined;
  private _featureService: IFeatureService = undefined;
  private _routingService: IRoutingService = undefined;
  private _processEngineService: IProcessEngineService = undefined;

  constructor(datastoreService: IDatastoreService, messagebusService: IMessageBusService, iamService: IIamService,
              eventAggregator: IEventAggregator, featureService: IFeatureService, routingService: IRoutingService,
              processEngineService: IProcessEngineService) {
    this._datastoreService = datastoreService;
    this._messagebusService = messagebusService;
    this._eventAggregator = eventAggregator;
    this._iamService = iamService;
    this._featureService = featureService;
    this._routingService = routingService;
    this._processEngineService = processEngineService;
  }

  // TODO: Heiko Mathes - replaced lazy datastoreService-injection with regular injection. is this ok?
  private get datastoreService(): IDatastoreService {
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

  private get processEngineService(): IProcessEngineService {
    return this._processEngineService;
  }

  private async _nodeHandler(event: any): Promise<void> {
    const binding: Binding = <any> this;

    const action = (event && event.data && event.data.action) ? event.data.action : null;
    const source: IEntity = (event && event.source) ? event.source : null;
    const context = (event && event.metadata && event.metadata.context) ? event.metadata.context : {};
    const applicationId = (event && event.metadata && event.metadata.applicationId) ? event.metadata.applicationId : null;
    const participant = (event && event.metadata && event.metadata.options && event.metadata.options.participantId) ? event.metadata.options.participantId : null;

    if (action === 'changeState') {
      const newState = (event && event.data && event.data.data) ? event.data.data : null;

      switch (newState) {
          case ('start'):
              await binding.entity.start(context, source);
              break;

          case ('execute'):
              await binding.entity.execute(context);
              break;

          case ('wait'):
            await binding.entity.wait(context);
            break;

          case ('end'):
              await binding.entity.end(context);
              break;

          case ('follow'):
          await binding.entity.followBoundary(context);
          break;

          default:
          // error ???
      }
    }

    if (action === 'proceed') {
      const newData = (event && event.data && event.data.token) ? event.data.token : null;
      await binding.entity.proceed(context, newData, source, applicationId, participant);
    }

    if (action === 'boundary') {
      const eventEntity = (event && event.data && event.data.eventEntity) ? event.data.eventEntity : null;
      const data = (event && event.data && event.data.data) ? event.data.data : null;
      await binding.entity.boundaryEvent(context, eventEntity, data, source, applicationId, participant);
    }

    if (action === 'event') {
      const eventType = (event && event.data && event.data.eventType) ? event.data.eventType : null;
      const data = (event && event.data && event.data.data) ? event.data.data : null;
      await binding.entity.event(context, eventType, data, source, applicationId, participant);
    }
  }

  private async _nodeHandlerMessagebus(msg: any): Promise<void> {
    const binding: Binding = <any> this;

    await binding.messagebusService.verifyMessage(msg);

    const context = (msg && msg.metadata && msg.metadata.context) ? msg.metadata.context : {};

    const sourceRef = (msg && msg.source) ? msg.source : null;
    let source = null;

    if (sourceRef) {

      const entityType = await binding.datastoreService.getEntityType(sourceRef._meta.type);
      try {
        source = await entityType.getById(sourceRef.id, context);
      } catch (err) {
        // source could not be found, ignore atm
      }
    }

    const payload: any = (msg && msg.data) ? msg.data : null;
    const action = (payload && payload.action) ? payload.action : null;

    if (action === 'proceed') {
      const newData = (payload && payload.token) ? payload.token : null;
      const applicationId = msg.metadata.applicationId;
      const participant = (msg.metadata.options) ? msg.metadata.options.participantId : null;
      await binding.entity.proceed(context, newData, source, applicationId, participant);
    }

    if (action === 'event') {
      const eventType = (payload && payload.eventType) ? payload.eventType : null;
      const data = (payload && payload.data) ? payload.data : null;
      binding.entity.triggerEvent(context, eventType, data);
    }
  }

  public async createNode(context: ExecutionContext, entityType: IEntityType<IEntity>): Promise<IEntity> {

    const internalContext = await this.iamService.createInternalContext('processengine_system');
    const node = await entityType.createEntity(internalContext);

    const binding: Binding = {
      entity: node,
      eventAggregator: this.eventAggregator,
      messagebusService: this.messagebusService,
      datastoreService: this.datastoreService,
    };

    const anyNode = <any> node;
    anyNode.eventAggregatorSubscription = this.eventAggregator.subscribe('/processengine/node/' + node.id, this._nodeHandler.bind(binding));
    anyNode.messagebusSubscription = this.messagebusService.subscribe('/processengine/node/' + node.id, this._nodeHandlerMessagebus.bind(binding));
    return anyNode;

  }

  public async createNextNode(context: ExecutionContext, source: any, nextDef: any, token: any): Promise<void> {

    // const process = await source.getProcess(internalContext);
    const process = source.process;

    const applicationId = source.application;

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

    if (nextDef.type === 'bpmn:ParallelGateway' && node && node.state === 'wait') {

      if (node) {
        const data = {
          action: 'proceed',
          token: null,
        };

        const event = this.eventAggregator.createEntityEvent(data, source, context, (source && ('participant' in source) ? { participantId: source.participant } : null ));
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
      node.application = applicationId;
      node.instanceCounter = count;

      if ('participant' in source) {
        node.participant =  source.participant;
      }

      if (nextDef.type === 'bpmn:BoundaryEvent') {
        node.attachedToInstance = source;
      }

      debugInfo(`node created key '${node.key}'`);

      node.changeState(context, 'start', source);
    }
  }

  public async continueExecution(context: ExecutionContext, source: IEntity): Promise<void> {
    const internalContext = await this.iamService.createInternalContext('processengine_system');

    const processTokenEntityType = await this.datastoreService.getEntityType('ProcessToken');

    const nodeInstance = <any> source;
    const splitToken = (nodeInstance.type === 'bpmn:ParallelGateway' && nodeInstance.parallelType === 'split') ? true : false;

    const nextDefs = [];

    const nodeDef = nodeInstance.nodeDef;

    const processDef = (<INodeInstanceEntity> source).process.processDef;

    const flowsOut = [];

    if (nodeInstance.follow) {
      // we have already a list of flows to follow
      if (nodeInstance.follow.length > 0) {

        for (let i = 0; i < processDef.flowDefCollection.data.length; i++) {
          const flowDef = <IFlowDefEntity> processDef.flowDefCollection.data[i];
          if (nodeInstance.follow.indexOf(flowDef.id) !== -1) {
            flowsOut.push(flowDef);
          }
        }
      }
    } else {

      for (let i = 0; i < processDef.flowDefCollection.data.length; i++) {
        const flowDef = <IFlowDefEntity> processDef.flowDefCollection.data[i];
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

      await (<INodeInstanceEntity> source).process.processDef.nodeDefCollection.each(internalContext, async(nodeDefEntity) => {
        if (ids.indexOf(nodeDefEntity.id) !== -1 && nodeDefEntity.processDef.id === processDef.id) {
          nextDefs.push(nodeDefEntity);
        }
      });

      if (nextDefs.length > 0) {

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

            if (processDef.persist) {
              await processToken.save(internalContext, { reloadAfterSave: false });
            }
          }

          if (splitToken && i > 0) {
            currentToken = await processTokenEntityType.createEntity(internalContext);
            currentToken.process = processToken.process;
            currentToken.data = processToken.data;

            if (processDef.persist) {
              await currentToken.save(internalContext, { reloadAfterSave: false });
            }

          } else {
            currentToken = processToken;
          }

          const laneRef = await nextDef.lane;
          const laneId = laneRef ? laneRef.id : undefined;
          let laneFeatures;
          for (let j = 0; j < processDef.laneCollection.data.length; j++) {
            const lane = <ILaneEntity> processDef.laneCollection.data[j];
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
              // TODO
              // if no application instance found, instatiate activtity anyway being in state beforeStart and wait for
              // first "registration" of compatible (feature-matching) application instance
              debugErr(`can not route to next node key '${nextDef.key }', features: ${JSON.stringify(features)}, no matching instance found`);
              throw new Error('can not route, no matching instance found');
            }

            const appInstanceId = appInstances[0];

            debugInfo(`continue on application '${appInstanceId}' with next node key '${nextDef.key}', features: ${JSON.stringify(features)}`);

            // Todo: set correct message format
            const options: IDatastoreMessageOptions = {
              action: 'POST',
              typeName: 'NodeInstance',
              method: 'continueFromRemote',
            };

            let data;
            if (processDef.persist) {
              data = [
                null,
                {
                  source: nodeInstance.getEntityReference().toPojo(),
                  nextDef: nextDef.getEntityReference().toPojo(),
                  token: currentToken.getEntityReference().toPojo(),
                },
              ];
            } else {
              data = [
                null,
                {
                  source: await nodeInstance.toPojo(internalContext, { maxDepth: 1 }),
                  nextDef: nextDef.getEntityReference().toPojo(),
                  token: await currentToken.toPojo(internalContext, { maxDepth: 1 }),
                },
              ];
            }

            const message: IDatastoreMessage = this.messagebusService.createDatastoreMessage(options, context, data);
            try {
              const adapterKey = this.featureService.getRoutingAdapterKeyByApplicationId(appInstanceId);
              await this.routingService.request(appInstanceId, message, adapterKey);
            } catch (err) {
              debugErr(`can not route to next node key '${nextDef.key}', features: ${JSON.stringify(features)}, error: ${err.message}`);

              // look for boundary error event

              if (nextDef && nextDef.events) {

                const event = nextDef.events.find((el) => {
                  return el.type === 'error';
                });

                if (event) {
                  const boundaryDefId = event.boundary;

                  const boundaryEntity = nodeInstance.process.processDef.nodeDefCollection.data.find((el) => {
                    return el.id === boundaryDefId;
                  });

                  // continue with boundary
                  await this.createNextNode(context, nodeInstance, boundaryEntity, currentToken);
                }
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

  // tslint:disable-next-line:cyclomatic-complexity
  public async continueFromRemote(context: ExecutionContext, params: IParamsContinueFromRemote, options?: IPublicGetOptions): Promise<void> {
    let source: any;
    let token: ProcessTokenEntity;
    let nextDef: INodeDefEntity;

    try {
      const internalContext = await this.iamService.createInternalContext('processengine_system');

      // Todo: restore entities from references respecting namespaces
      const processTokenEntityType = await this.datastoreService.getEntityType<ProcessTokenEntity>('ProcessToken');
      const nodeDefEntityType = await this.datastoreService.getEntityType<NodeDefEntity>('NodeDef');

      const nextDefRef = new EntityReference(params.nextDef._meta.namespace, params.nextDef._meta.type, params.nextDef.id);
      nextDef = await nodeDefEntityType.getById(nextDefRef.id, context);

      const processDef = await nextDef.getProcessDef(internalContext);

      if (params.source._meta.isRef) {
        // source is a pojo of an entityRef
        const sourceRef = new EntityReference(params.source._meta.namespace, params.source._meta.type, params.source.id);
        const sourceEntityType = await this.datastoreService.getEntityType(sourceRef.type);
        if (sourceEntityType && sourceRef.id) {
          source = await sourceEntityType.getById(sourceRef.id, context);
        }
      } else {
        // source is a pojo of an entity
        const sourceEntityType = await this.datastoreService.getEntityType(params.source._meta.type);
        if (sourceEntityType) {
          source = await sourceEntityType.createEntity(context, params.source);

        }
      }

      if (params.token._meta.isRef) {
        // token is a pojo of an entityRef
        const tokenRef = new EntityReference(params.token._meta.namespace, params.token._meta.type, params.token.id);
        token = await processTokenEntityType.getById(tokenRef.id, context);
      } else {
        // token is a pojo of an entity
        token = <ProcessTokenEntity> await processTokenEntityType.createEntity(context, params.token);
      }

      const sourceProcessRef = source && source.process ? source.process : undefined;
      let processEntity: IProcessEntity;

      if (sourceProcessRef) {
        // process should be restored
        const processData = {
          id: sourceProcessRef.id,
          key: processDef.key,
          processDef: processDef,
        };

        const processEntityType = await this.datastoreService.getEntityType('Process');
        processEntity = (await processEntityType.createEntity(context, processData)) as IProcessEntity;

        processEntity.status = 'progress';

        if (processDef.persist) {
          await processEntity.save(internalContext, { reloadAfterSave: false, isNew: false });
        }

        await processDef.getNodeDefCollection(internalContext);
        await processDef.nodeDefCollection.each(internalContext, async(nodeDef) => {
          nodeDef.processDef = processDef;
        });
        await processDef.getFlowDefCollection(internalContext);
        await processDef.flowDefCollection.each(internalContext, async(flowDef) => {
          flowDef.processDef = processDef;
        });
        await processDef.getLaneCollection(internalContext);
        await processDef.laneCollection.each(internalContext, async(lane) => {
          lane.processDef = processDef;
        });

        // set lane entities
        for (let i = 0; i < processDef.nodeDefCollection.length; i++) {
          const nodeDef = <INodeDefEntity> processDef.nodeDefCollection.data[i];

          if (nodeDef.lane) {
            const laneId = nodeDef.lane.id;
            for (let j = 0; j < processDef.laneCollection.length; j++) {
              const lane = <ILaneEntity> processDef.laneCollection.data[j];
              if (lane.id === laneId) {
                nodeDef.lane = lane;
              }
            }
          }
        }

        if (source && processEntity) {
          source.process = processEntity;
        }

        if (source && token) {
          if (processEntity) {
            token.process = processEntity;
          }
          source.processToken = token;
        }
      }

      if (source && token && nextDef) {
        await this.createNextNode(context, source, nextDef, token);
      } else {
        throw new Error('param is missing');
      }
    } catch (err) {
      debugErr(err);
      throw err;
    }
  }
}
