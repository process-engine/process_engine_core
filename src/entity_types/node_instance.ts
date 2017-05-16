import { ExecutionContext, SchemaAttributeType, IInheritedSchema, IEntity, ICombinedQueryClause, IIamService, IEntityReference, IQueryObject } from '@process-engine-js/core_contracts';
import { Entity, EntityDependencyHelper, EntityReference } from '@process-engine-js/data_model_contracts';
import { INodeInstanceEntity, INodeInstanceEntityTypeService, INodeDefEntity, IProcessEntity, IProcessTokenEntity, IProcessEngineService, IBoundaryEventEntity } from '@process-engine-js/process_engine_contracts';
import { schemaAttribute, schemaClass } from '@process-engine-js/metadata';
import { IMessageBusService, IMessageSubscription } from '@process-engine-js/messagebus_contracts';
import { IEventAggregator, ISubscription } from '@process-engine-js/event_aggregator_contracts';
import { ITimingService } from '@process-engine-js/timing_contracts';

import * as debug from 'debug';
const debugInfo = debug('processengine:info');
const debugErr = debug('processengine:error');

export class NodeInstanceEntityDependencyHelper {
  
  public messageBusService: IMessageBusService = undefined;
  public eventAggregator: IEventAggregator = undefined;
  public iamService: IIamService = undefined;
  public nodeInstanceEntityTypeService: INodeInstanceEntityTypeService = undefined;
  public processEngineService: IProcessEngineService = undefined;
  public timingService: ITimingService = undefined;

  constructor(messageBusService: IMessageBusService, eventAggregator: IEventAggregator, iamService: IIamService, nodeInstanceEntityTypeService: INodeInstanceEntityTypeService, processEngineService: IProcessEngineService, timingService: ITimingService) {
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
    { attribute: 'nodeDef'}
  ]
})
export class NodeInstanceEntity extends Entity implements INodeInstanceEntity {

  private _nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper = undefined;
  public messagebusSubscription: Promise<IMessageSubscription> = undefined;
  public eventAggregatorSubscription: ISubscription = undefined;

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

    // check if context matches to lane
    let role = await this.nodeDef.lane.role;
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

    this.process.addActiveInstance(this);

    const processToken = this.processToken;

    for (let i = 0; i < this.process.processDef.nodeDefCollection.data.length; i++) {
      const boundary = <INodeDefEntity>this.process.processDef.nodeDefCollection.data[i];
      if (boundary.attachedToNode && boundary.attachedToNode.id === this.nodeDef.id) {
        if (boundary.eventType === 'bpmn:TimerEventDefinition' || boundary.eventType === 'bpmn:MessageEventDefinition' || boundary.eventType === 'bpmn:SignalEventDefinition') {
          await this.nodeInstanceEntityTypeService.createNextNode(context, this, boundary, processToken);
        }
      }
    }

    this.changeState(context, 'execute', this);
  }


  public changeState(context: ExecutionContext, newState: string, source: IEntity) {

    debugInfo(`change state of node, id ${this.id}, key ${this.key}, type ${this.type},  new state: ${newState}`);

    const data = {
      action: 'changeState',
      data: newState
    };

    const event = this.eventAggregator.createEntityEvent(data, source, context);
    this.eventAggregator.publish('/processengine/node/' + this.id, event);
  }

  public error(context: ExecutionContext, error: any): void {

    debugErr(`node error, id ${this.id}, key ${this.key}, type ${this.type}, ${error}`);

    const nodeDef = this.nodeDef;

    let event = undefined;
    if (nodeDef.events) {
      event = nodeDef.events.find((el) => {
        return el.type === 'error';
      });
    }
    if (event) {

      const data = {
        action: 'event',
        event: 'error',
        data: error
      };

      const event = this.eventAggregator.createEntityEvent(data, this, context);
      this.eventAggregator.publish('/processengine/node/' + this.id, event);
    }
  }

  public async wait(context: ExecutionContext): Promise<void> {
    debugInfo(`execute node, id ${this.id}, key ${this.key}, type ${this.type}`);
    const internalContext = await this.iamService.createInternalContext('processengine_system');

    this.state = 'wait';

    if (this.process.processDef.persist) {
      await this.save(internalContext, { reloadAfterSave: false });
    }

  }


  public async execute(context: ExecutionContext): Promise<void> {
    debugInfo(`execute node, id ${this.id}, key ${this.key}, type ${this.type}`);

    this.state = 'progress';

    this.changeState(context, 'end', this);
  }


  public async proceed(context: ExecutionContext, data: any, source: IEntity, applicationId: string): Promise<void> {
    // by default do nothing, implementation should be overwritten by child class
  }


  public async event(context: ExecutionContext, event: string, data: any, source: IEntity, applicationId: string): Promise<void> {

    debugInfo(`node event, id ${this.id}, key ${this.key}, type ${this.type}, event ${event}`);

    const internalContext = await this.iamService.createInternalContext('processengine_system');

    // check if definition exists
    const nodeDef = this.nodeDef;
    if (nodeDef && nodeDef.events) {

      const events = nodeDef.events.filter((el) => {
        return el.type === event;
      });

      const processToken = await this.processToken;
      const tokenData = processToken.data || {};

      for (let i = 0; i < events.length; i++) {
        const boundaryId = events[i].boundary;

        const boundaryDef = <INodeDefEntity>this.process.processDef.nodeDefCollection.data.find((el) => {
          return el.id === boundaryId;
        });

        let boundary;
        let self = this;
        Object.keys(this.process.activeInstances).forEach((id) => {
          const instance = this.process.activeInstances[id];
          if (instance.attachedToInstance && instance.attachedToInstance.id === self.id && instance.nodeDef.id === boundaryId) {
            boundary = instance;
          }
        });


        if (boundaryDef) {
          switch (event) {
            case 'error':
              await this.end(context, true);
              break;

            case 'timer':
              boundary.changeState(context, 'end', this);

              if (boundaryDef.cancelActivity) {
                await this.end(internalContext, true);
              }
              break;

            case 'signal':

              break;

            case 'message':

              break;

            case 'cancel':

              break;

            case 'condition':
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
                  await this.nodeInstanceEntityTypeService.createNextNode(context, this, boundaryDef, processToken);
                  if (boundaryDef.cancelActivity) {
                    await this.end(internalContext, true);
                  }
                }
              }
              break;

            default:
              
          }

          // await this.nodeInstanceEntityTypeService.createNextNode(context, this, boundary, token);
        }

        
      }

    }
  }


  public async cancel(context: ExecutionContext): Promise<void> {

    debugInfo(`node cancel, id ${this.id}, key ${this.key}, type ${this.type}`);

    const nodeDef = this.nodeDef;
    if (nodeDef && nodeDef.events && nodeDef.events.cancel) {

      const data = {
        action: 'event',
        event: 'cancel',
        data: null
      };

      const msg = this.eventAggregator.createEntityEvent(data, this, context);
      this.eventAggregator.publish('/processengine/node/' + this.id, msg);
    }
  }


  public async end(context: ExecutionContext, cancelFlow: boolean = false): Promise<void> {

    debugInfo(`end node, id ${this.id}, key ${this.key}, type ${this.type}`);

    const internalContext = await this.iamService.createInternalContext('processengine_system');

    this.state = 'end';

    this.process.removeActiveInstance(this);

    if (this.process.processDef.persist) {
      await this.save(internalContext, { reloadAfterSave: false });
    }

    const nodeInstance = this as any;
    const isEndEvent = (nodeInstance.type === 'bpmn:EndEvent');

    const processToken = this.processToken;

    const tokenData = processToken.data || {};

    const nodeDef = this.nodeDef;
    const mapper = nodeDef.mapper;

    if (mapper !== undefined) {
      const newCurrent = (new Function('token', 'return ' + mapper)).call(tokenData, tokenData);
      tokenData.current = newCurrent;
    }

    tokenData.history = tokenData.history || {};

    if (tokenData.history.hasOwnProperty(this.key) || this.instanceCounter > 0) {
      if (this.instanceCounter === 1) {
        const arr = [];
        arr.push(tokenData.history[this.key]);
        arr.push(tokenData.current);
        tokenData.history[this.key] = arr;
      } else {
        tokenData.history[this.key].push(tokenData.current);
      }

    } else {
      tokenData.history[this.key] = tokenData.current;
    }

    processToken.data = tokenData;

    if (this.process.processDef.persist) {
      await processToken.save(internalContext, { reloadAfterSave: false });
    }

    // cancel subscriptions
    nodeInstance.eventAggregatorSubscription.dispose();
    nodeInstance.messagebusSubscription.cancel();

    if (!isEndEvent && !cancelFlow) {
      try {
      await this.nodeInstanceEntityTypeService.continueExecution(context, nodeInstance);
      } catch (err) {
        // we can't continue, handle error in process
        const process = await this.getProcess(internalContext);
        await process.error(context, err);
      }
    } else {
      const process = await this.getProcess(internalContext);
      await process.end(context, processToken);
    }
  }


}
