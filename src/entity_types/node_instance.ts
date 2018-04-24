import { ExecutionContext, IEntity, IIamService, IInheritedSchema, SchemaAttributeType} from '@essential-projects/core_contracts';
import { Entity, EntityDependencyHelper, IEntityType, IPropertyBag } from '@essential-projects/data_model_contracts';
import { IEventAggregator, ISubscription } from '@essential-projects/event_aggregator_contracts';
import { IMessageBusService, IMessageSubscription } from '@essential-projects/messagebus_contracts';
import { schemaAttribute, schemaClass } from '@essential-projects/metadata';
import { ITimingService } from '@essential-projects/timing_contracts';
import { BpmnType, IBoundaryEventEntity, INodeDefEntity, INodeInstanceEntity, INodeInstanceEntityTypeService,
  IProcessEngineService, IProcessEntity, IProcessTokenEntity } from '@process-engine/process_engine_contracts';

import * as debug from 'debug';
const debugInfo: debug.IDebugger = debug('processengine:info');
const debugErr: debug.IDebugger = debug('processengine:error');

// TODO: Refactor this the remove these REALLY annoying errors!
// tslint:disable:cyclomatic-complexity
// tslint:disable:max-classes-per-file
// tslint:disable:max-file-line-count
export class NodeInstanceEntityDependencyHelper {

  public messageBusService: IMessageBusService = undefined;
  public eventAggregator: IEventAggregator = undefined;
  public iamService: IIamService = undefined;
  public nodeInstanceEntityTypeService: INodeInstanceEntityTypeService = undefined;
  public processEngineService: IProcessEngineService = undefined;
  public timingService: ITimingService = undefined;

  constructor(messageBusService: IMessageBusService, eventAggregator: IEventAggregator, iamService: IIamService,
              nodeInstanceEntityTypeService: INodeInstanceEntityTypeService, processEngineService: IProcessEngineService,
              timingService: ITimingService) {
    this.messageBusService = messageBusService;
    this.eventAggregator = eventAggregator;
    this.iamService = iamService;
    this.nodeInstanceEntityTypeService = nodeInstanceEntityTypeService;
    this.processEngineService = processEngineService;
    this.timingService = timingService;
  }
}

@schemaClass({
  expandEntity: [
    { attribute: 'nodeDef'},
  ],
})
export class NodeInstanceEntity extends Entity implements INodeInstanceEntity {

  private _nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper = undefined;
  public messagebusSubscription: Promise<IMessageSubscription> = undefined;
  public eventAggregatorSubscription: ISubscription = undefined;

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper,
              entityDependencyHelper: EntityDependencyHelper,
              context: ExecutionContext,
              schema: IInheritedSchema,
              propertyBag: IPropertyBag,
              entityType: IEntityType<IEntity>) {
    super(entityDependencyHelper, context, schema, propertyBag, entityType);

    this._nodeInstanceEntityDependencyHelper = nodeInstanceEntityDependencyHelper;
  }

  protected get iamService(): IIamService {
    return this._nodeInstanceEntityDependencyHelper.iamService;
  }

  protected get messageBusService(): IMessageBusService {
    return this._nodeInstanceEntityDependencyHelper.messageBusService;
  }

  protected get eventAggregator(): IEventAggregator {
    return this._nodeInstanceEntityDependencyHelper.eventAggregator;
  }

  protected get nodeInstanceEntityTypeService(): INodeInstanceEntityTypeService {
    return this._nodeInstanceEntityDependencyHelper.nodeInstanceEntityTypeService;
  }

  protected get processEngineService(): IProcessEngineService {
    return this._nodeInstanceEntityDependencyHelper.processEngineService;
  }

  protected get timingService(): ITimingService {
    return this._nodeInstanceEntityDependencyHelper.timingService;
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    await super.initialize(derivedClassInstance || this);
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
  public get type(): BpmnType {
    return this.getProperty(this, 'type');
  }

  public set type(value: BpmnType) {
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

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get application(): string {
    return this.getProperty(this, 'application');
  }

  public set application(value: string) {
    this.setProperty(this, 'application', value);
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

  @schemaAttribute({ type: SchemaAttributeType.number })
  public get instanceCounter(): number {
    return this.getProperty(this, 'instanceCounter');
  }

  public set instanceCounter(value: number) {
    this.setProperty(this, 'instanceCounter', value);
  }

  public async getLaneRole(context: ExecutionContext): Promise<string> {
    const nodeDef = this.nodeDef;
    const role = await nodeDef.getLaneRole(context);
    return role;
  }

  public async start(context: ExecutionContext, source: IEntity): Promise<void> {

    debugInfo(`start node, id ${this.id}, key ${this.key}, type ${this.type}`);

    if (!this.state) {
      this.state = 'start';
    }

    this.process.addActiveInstance(this);

    const internalContext = await this.iamService.createInternalContext('processengine_system');

    const processTokenEntityType = await (await this.getDatastoreService()).getEntityType('ProcessToken');

    const boundaryNodeCreatePromises = [];
    for (let i = 0; i < this.process.processDef.nodeDefCollection.data.length; i++) {
      const boundary = <INodeDefEntity> this.process.processDef.nodeDefCollection.data[i];
      if (boundary.attachedToNode && boundary.attachedToNode.id === this.nodeDef.id) {
        boundaryNodeCreatePromises.push(this.nodeInstanceEntityTypeService.createNextNode(context, this, boundary, this.processToken));
      }
    }

    await this._waitForBoundaryNodesToIdle(boundaryNodeCreatePromises);
    this.changeState(context, 'execute', this);
  }

  private async _waitForBoundaryNodesToIdle(boundaryNodePromises: Array<Promise<IEntity>>): Promise<void> {
    if (boundaryNodePromises.length === 0) {
      return Promise.resolve();
    }

    const nodes: Array<IEntity> = await Promise.all(boundaryNodePromises);
    const finishedNodes: {[nodeId: string]: boolean} = {};
    let unfinishedNodes: number = nodes.length;

    return new Promise<void>((resolve: any, reject: any): void => {

      for (const node of nodes) {
        finishedNodes[node.id] = false;
        const subscription: ISubscription = this.eventAggregator.subscribe(`/processengine/node/${node.id}`, (event: any) => {
          if (!event ||
              !event.data ||
              event.data.eventType !== 'waitTransitionFinished') {
                return;
              }

          if (finishedNodes[node.id] === true) {
            throw new Error(`Boundary ${node.id} changed to state 'wait' twice during creation`);
          }
          finishedNodes[node.id] = true;
          subscription.dispose();

          unfinishedNodes--;
          if (unfinishedNodes === 0) {
            resolve();
          }
        });
      }
    });
  }

  public changeState(context: ExecutionContext, newState: string, source: INodeInstanceEntity): void {

    debugInfo(`change state of node, id ${this.id}, key ${this.key}, type ${this.type},  new state: ${newState}`);

    const data = {
      action: 'changeState',
      data: newState,
    };

    const event = this.eventAggregator.createEntityEvent(data, source, context, (source && ('participant' in source) ? { participantId: source.participant } : null ));
    this.eventAggregator.publish('/processengine/node/' + this.id, event);
  }

  public error(context: ExecutionContext, error: any): void {
    debugErr(`node error, id ${this.id}, key ${this.key}, type ${this.type}, ${error}`);
    this.triggerEvent(context, 'error', error);
  }

  public async wait(context: ExecutionContext): Promise<void> {
    debugInfo(`execute node, id ${this.id}, key ${this.key}, type ${this.type}`);
    const internalContext = await this.iamService.createInternalContext('processengine_system');

    this.state = 'wait';

    if (this.process.processDef.persist) {
      await this.save(internalContext, { reloadAfterSave: false });
    }

    this.triggerEvent(context, 'waitTransitionFinished', null);
  }

  public async execute(context: ExecutionContext): Promise<void> {
    debugInfo(`execute node, id ${this.id}, key ${this.key}, type ${this.type}`);

    this.state = 'progress';

    this.changeState(context, 'end', this);
  }

  public async proceed(context: ExecutionContext, data: any, source: IEntity, applicationId: string, participant: string): Promise<void> {
    // by default do nothing, implementation should be overwritten by child class
  }

  public triggerEvent(context: ExecutionContext, eventType: string, data: any): void {
    const payload = {
      action: 'event',
      eventType: eventType,
      data: data,
    };

    const entityEvent = this.eventAggregator.createEntityEvent(payload, this, context, (('participant' in this) ? { participantId: this.participant } : null));
    this.eventAggregator.publish('/processengine/node/' + this.id, entityEvent);
  }

  private async _publishToApi(context: ExecutionContext, eventType: string, data?: any): Promise<void> {
    const payload = {
      action: 'event',
      eventType: eventType,
      data: data,
    };

    const msg = this.messageBusService.createEntityMessage(payload, this, context);
    await this.messageBusService.publish('/processengine_api/event/' + this.id, msg);
  }

  private async _informProcessSubscribers(context, eventType, data): Promise<void> {

    const payload = {
      action: 'event',
      event: eventType,
      data: data,
    };
    const process = await this.getProcess(context);
    const processInstanceChannel = `/processengine/process/${process.id}`;
    const msg = this.messageBusService.createEntityMessage(payload, this, context);
    await this.messageBusService.publish(processInstanceChannel, msg);
  }

  public async event(context: ExecutionContext, eventType: string, data: any, source: IEntity, applicationId: string, participant: string): Promise<void> {
    debugInfo(`node event, id ${this.id}, key ${this.key}, type ${this.type}, event ${eventType}`);

    const internalContext = await this.iamService.createInternalContext('processengine_system');

    const map = new Map();
    map.set('error', 'bpmn:ErrorEventDefinition');
    map.set('cancel', 'bpmn:CancelEventDefinition');
    map.set('data', 'bpmn:ConditionalEventDefinition');
    const bpmnType = map.get(eventType);

    // get boundary event instance and handle event
    const activeInstancesKeys = Object.keys(this.process.activeInstances);
    const boundaries = [];
    for (let i = 0; i < activeInstancesKeys.length; i++) {
      const boundaryEntity = <IBoundaryEventEntity> this.process.activeInstances[activeInstancesKeys[i]];
      if (boundaryEntity.attachedToInstance && (boundaryEntity.attachedToInstance.id === this.id) && (boundaryEntity.nodeDef.eventType === bpmnType)) {
        boundaries.push(boundaryEntity);
      }
    }

    if (boundaries.length > 0) {
      // we have 1 or more boundaries, let it handle the event
      for (let i = 0; i < boundaries.length; i++) {
        await this.boundaryEvent(context, boundaries[i], data, source, applicationId, participant);
      }
    } else {
      // error or cancel ends the node anyway
      if (eventType === 'error' || eventType === 'cancel') {
        if (eventType === 'error') {
          // we lose the stack trace, but Faye seems to be unable to serialize the full error
          if (typeof data.serialize === 'function') {
            data = {
              serializedError: data.serialize(),
            };
          } else {
            data = {
              error: {
                message: data.message,
                name: data.constructor.name,
              },
            };
          }
          // if it's an error we have to notify the ProcessEngineService, so that the caller who started the process
          // can get the promise he's waiting on rejected with the error we're providing here
          await this._informProcessSubscribers(context, eventType, data);
        }
        await this._publishToApi(context, eventType, data);
        await this.end(context, true);
      }
    }

  }

  public triggerBoundaryEvent(context: ExecutionContext, eventEntity: IBoundaryEventEntity, data: any): void {
    const payload = {
      action: 'boundary',
      eventEntity: eventEntity,
      data: data,
    };

    const entityEvent = this.eventAggregator.createEntityEvent(payload, this, context, (('participant' in this) ? { participantId: this.participant } : null));
    this.eventAggregator.publish('/processengine/node/' + this.id, entityEvent);
  }

  public async boundaryEvent(context: ExecutionContext, eventEntity: IBoundaryEventEntity, data: any, source: IEntity, applicationId: string, participant: string): Promise<void> {

    debugInfo(`node boundary event, id ${this.id}, key ${this.key}, type ${this.type}, event ${eventEntity.type}`);

    const internalContext = await this.iamService.createInternalContext('processengine_system');

    const boundaryDef = eventEntity.nodeDef;
    const processToken = await eventEntity.processToken;
    const tokenData: any = processToken.data || {};

    if (boundaryDef) {
      switch (boundaryDef.eventType) {
        case 'bpmn:ErrorEventDefinition':

          const errCode = data.number || data.code || data.errorCode || undefined;
          if ((boundaryDef.errorCode && errCode && boundaryDef.errorCode === errCode.toString()) || !boundaryDef.errorCode) {

            // save new data in token
            const processToken = this.processToken;
            const tokenData = processToken.data || {};

            data = { message: data.message, errorCode: errCode };

            tokenData.current = data;
            processToken.data = tokenData;

            await this._publishToApi(context, 'cancel', data);
            eventEntity.changeState(context, 'end', this);
            await this.end(context, true);
          }
          break;

        case 'bpmn:TimerEventDefinition':

          if (boundaryDef.cancelActivity) {
            eventEntity.changeState(context, 'end', this);
            this.cancel(internalContext);
          } else {
            await this._publishToApi(context, 'timer', data);
            eventEntity.changeState(context, 'follow', this);
          }
          break;

        case 'bpmn:SignalEventDefinition':
          if (boundaryDef.cancelActivity) {

            // save new data in token
            const processToken = this.processToken;
            const tokenData = processToken.data || {};
            tokenData.current = data;
            processToken.data = tokenData;

            eventEntity.changeState(context, 'end', this);
            this.cancel(context);
          } else {

            if (this.processToken.data === undefined || this.processToken.data === null) {
              this.processToken.data = {};
            }
            this.processToken.data.current = data;

            await this._publishToApi(context, 'signal', data);
            eventEntity.changeState(context, 'follow', this);
          }
          break;

        case 'bpmn:MessageEventDefinition':
          if (boundaryDef.cancelActivity) {

            // save new data in token
            const processToken = this.processToken;
            const tokenData = processToken.data || {};
            tokenData.current = data;
            processToken.data = tokenData;

            eventEntity.changeState(context, 'end', this);
            this.cancel(context);
          } else {

            if (this.processToken.data === undefined || this.processToken.data === null) {
              this.processToken.data = {};
            }
            this.processToken.data.current = data;

            if (this.nodeDef.processDef.persist) {
              await this.processToken.save(internalContext, { reloadAfterSave: false });
            }

            await this._publishToApi(context, 'message', data);
            eventEntity.changeState(context, 'follow', this);
          }
          break;

        case 'bpmn:CancelEventDefinition':
          await this._publishToApi(context, 'cancel', data);
          eventEntity.changeState(context, 'end', this);
          await this.end(context, true);
          break;

        case 'bpmn:ConditionalEventDefinition':
          if (boundaryDef.condition) {
            const functionString = 'return ' + boundaryDef.condition;
            const evaluateFunction = new Function('token', functionString);
            tokenData.current = data;
            let result;
            try {
              result = evaluateFunction.call(tokenData, tokenData);
            } catch (err) {
              debugErr(`error evaluating condition '${boundaryDef.condition}', key ${boundaryDef.key}`);
            }
            if (result) {
              if (boundaryDef.cancelActivity) {

                processToken.data = tokenData;

                eventEntity.changeState(context, 'end', this);
                this.cancel(internalContext);
              } else {

                if (this.processToken.data === undefined || this.processToken.data === null) {
                  this.processToken.data = {};
                }
                this.processToken.data.current = data;

                await this._publishToApi(context, 'conditional', data);
                eventEntity.changeState(context, 'follow', this);
              }
            }
          }
          break;

        default:
      }
    }

  }

  public cancel(context: ExecutionContext): void {
    debugInfo(`node cancel, id ${this.id}, key ${this.key}, type ${this.type}`);
    this.triggerEvent(context, 'cancel', null);
  }

  // follow next flow, but not end current node (non interrupting boundaries)
  public async followBoundary(context: ExecutionContext): Promise<void> {
    debugInfo(`follow boundary, id ${this.id}, key ${this.key}, type ${this.type}`);

    const internalContext = await this.iamService.createInternalContext('processengine_system');
    await this._updateToken(internalContext);
    const nodeInstance = this as any;
    try {
      await this.nodeInstanceEntityTypeService.continueExecution(context, nodeInstance);
    } catch (err) {
      // we can't continue, handle error in process
      const process = await this.getProcess(internalContext);
      process.error(context, err);
    }
  }

  private async _updateToken(context: ExecutionContext) {
    const processToken = this.processToken;

    const tokenData = processToken.data || {};

    const nodeDef = this.nodeDef;
    const mapper = nodeDef.mapper;

    if (mapper !== undefined) {
      const newCurrent = (new Function('token', 'return ' + mapper)).call(tokenData, tokenData);
      tokenData.current = newCurrent;
    }

    const isSubProcessEndEvent: boolean = (this.type === 'bpmn:EndEvent' && !!nodeDef.belongsToSubProcessKey);
    const tokenKey: string = isSubProcessEndEvent ? nodeDef.belongsToSubProcessKey : this.key;

    tokenData.history = tokenData.history || {};

    if (tokenData.history.hasOwnProperty(tokenKey) || this.instanceCounter > 0) {
      if (this.instanceCounter === 1) {
        const arr = [];
        arr.push(tokenData.history[tokenKey]);
        arr.push(tokenData.current);
        tokenData.history[tokenKey] = arr;
      } else {
        if (!Array.isArray(tokenData.history[tokenKey])) {
          tokenData.history[tokenKey] = [];
        }
        tokenData.history[tokenKey].push(tokenData.current);
      }

    } else {
      tokenData.history[tokenKey] = tokenData.current;
    }

    processToken.data = tokenData;

    if (this.process.processDef.persist) {
      await processToken.save(context, { reloadAfterSave: false });
    }
  }

  public async end(context: ExecutionContext, cancelFlow: boolean = false): Promise<void> {

    const isEndEvent: boolean = this.type === BpmnType.endEvent;
    const isTerminateEndEvent: boolean = this.nodeDef.eventType === 'bpmn:TerminateEventDefinition';

    this.state = isTerminateEndEvent ? 'terminate' : 'end';

    debugInfo(`${this.state} node, id ${this.id}, key ${this.key}, type ${this.type}`);

    const internalContext: ExecutionContext = await this.iamService.createInternalContext('processengine_system');

    this.process.removeActiveInstance(this);

    if (this.process.processDef.persist) {
      await this.save(internalContext, { reloadAfterSave: false });
    }

    await this._updateToken(internalContext);
    const processToken: IProcessTokenEntity = this.processToken;

    // cancel subscriptions
    this.eventAggregatorSubscription.dispose();
    const messagebusSubscription: IMessageSubscription = await this.messagebusSubscription;
    messagebusSubscription.cancel();

    // if event entity dispose subscriptions for timers, messages & signals
    if ((<any> this)._subscription) {
      (<any> this)._subscription.dispose();
    }

    if (!isTerminateEndEvent) {
      // dispose boundary events
      const activeInstancesKeys: Array<string> = Object.keys(this.process.activeInstances);
      for (const instanceKey of activeInstancesKeys) {
        const boundaryEntity: IBoundaryEventEntity = <IBoundaryEventEntity> this.process.activeInstances[instanceKey];

        if (boundaryEntity.attachedToInstance && (boundaryEntity.attachedToInstance.id === this.id)) {
          await boundaryEntity.end(context, true);
        }
      }
    }

    if ((!isEndEvent || (isEndEvent && !!this.nodeDef.belongsToSubProcessKey)) && !cancelFlow) {
      try {
        await this.nodeInstanceEntityTypeService.continueExecution(context, this);
      } catch (err) {
        // we can't continue, handle error in process
        this.process.error(context, err);
      }
    } else if (isTerminateEndEvent) {
      await this.process.terminate(context, processToken);
    } else {
      await this.process.end(context, processToken, this.key);
    }
  }

  public async terminate(context: ExecutionContext): Promise<void> {
    this.state = 'terminate';

    debugInfo(`terminate node, id ${this.id}, key ${this.key}, type ${this.type}`);

    const internalContext: ExecutionContext = await this.iamService.createInternalContext('processengine_system');

    this.process.removeActiveInstance(this);

    if (this.process.processDef.persist) {
      await this.save(internalContext, { reloadAfterSave: false });
    }

    await this._updateToken(internalContext);
    const processToken: IProcessTokenEntity = this.processToken;

    // cancel subscriptions
    this.eventAggregatorSubscription.dispose();
    const messagebusSubscription: IMessageSubscription = await this.messagebusSubscription;
    messagebusSubscription.cancel();

    // if event entity dispose subscriptions for timers, messages & signals
    if ((<any> this)._subscription) {
      (<any> this)._subscription.dispose();
    }
  }

  public parseExtensionProperty(propertyString: string, token: any, context: ExecutionContext): any {
    if (typeof propertyString === 'string' && propertyString.length > 1 && propertyString.charAt(0) === '$') {

      const functionString: string = `return ${propertyString.substr(1)}`;
      const evaluateFunction: Function = new Function('token', 'context', functionString);
      let result: any;
      try {
        result = evaluateFunction.call(undefined, token, context);
      } catch (err) {
        throw new Error ('parsing extension property failed');
      }

      return result;
    } else {
      return propertyString;
    }
  }
}
