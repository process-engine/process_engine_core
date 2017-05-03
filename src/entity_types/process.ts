import {ExecutionContext, SchemaAttributeType, IEntity, IPublicGetOptions, IInheritedSchema, IIamService, IQueryObject } from '@process-engine-js/core_contracts';
import { Entity, EntityDependencyHelper, IDatastoreService, EntityCollection } from '@process-engine-js/data_model_contracts';
import { IProcessEntity, IProcessDefEntity, IParamStart, IProcessTokenEntity, IStartEventEntity, INodeInstanceEntityTypeService, INodeDefEntity, ILaneEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';

export class ProcessEntity extends Entity implements IProcessEntity {

  private _iamService: IIamService = undefined;
  private _nodeInstanceEntityTypeService: INodeInstanceEntityTypeService = undefined;
  private _messageBusService: IMessageBusService = undefined;
  private _activeInstances: any = {};

  constructor(iamService: IIamService,
              nodeInstanceEntityTypeService: INodeInstanceEntityTypeService, 
              messageBusService: IMessageBusService,
              entityDependencyHelper: EntityDependencyHelper, 
              context: ExecutionContext,
              schema: IInheritedSchema) {
    super(entityDependencyHelper, context, schema);

    this._iamService = iamService;
    this._nodeInstanceEntityTypeService = nodeInstanceEntityTypeService;
    this._messageBusService = messageBusService;
  }

  private get iamService(): IIamService {
    return this._iamService;
  }

  private get nodeInstanceEntityTypeService(): INodeInstanceEntityTypeService {
    return this._nodeInstanceEntityTypeService;
  }

  private get messageBusService(): IMessageBusService {
    return this._messageBusService;
  } 

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  public get activeInstances(): any {
    return this._activeInstances;
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

  @schemaAttribute({ type: SchemaAttributeType.boolean })
  public get isSubProcess(): boolean {
    return this.getProperty(this, 'isSubProcess');
  }

  public set isSubProcess(value: boolean) {
    this.setProperty(this, 'isSubProcess', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get callerId(): string {
    return this.getProperty(this, 'callerId');
  }

  public set callerId(value: string) {
    this.setProperty(this, 'callerId', value);
  }


  public async start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<void> {
    
    const source = params ? params.source : undefined;
    const isSubProcess = params ? params.isSubProcess : false;
    const initialToken = params ? params.initialToken : undefined;

    const ProcessToken = await this.datastoreService.getEntityType('ProcessToken');
    const StartEvent = await this.datastoreService.getEntityType('StartEvent');

    const internalContext: ExecutionContext = await this.iamService.createInternalContext('processengine_system');
    let laneContext = context;

    let participant = null;

    this.isSubProcess = isSubProcess;
    this.callerId = (isSubProcess && source) ? source.id : null;
    await this.save(internalContext);

    if (!isSubProcess) {
      participant = source || null;
    }
  
    const processDef = await this.getProcessDef(internalContext);

    await processDef.getNodeDefCollection(internalContext);
    await processDef.nodeDefCollection.each(internalContext, async (nodeDef) => {
      nodeDef.processDef = processDef;
    });
    await processDef.getFlowDefCollection(internalContext);
    await processDef.flowDefCollection.each(internalContext, async (flowDef) => {
      flowDef.processDef = processDef;
    });
    await processDef.getLaneCollection(internalContext);
    await processDef.laneCollection.each(internalContext, async (lane) => {
      lane.processDef = processDef;
    });


    // get start event, set lane entities
    let startEventDef = undefined;
    for (let i = 0; i < processDef.nodeDefCollection.length; i++) {
      const nodeDef = <INodeDefEntity>processDef.nodeDefCollection.data[i];

      if (nodeDef.lane) {
        const laneId = nodeDef.lane.id;
        for (let j = 0; j < processDef.laneCollection.length; j++) {
          const lane = <ILaneEntity>processDef.laneCollection.data[j];
          if (lane.id === laneId) {
            nodeDef.lane = lane;
          }
        }
      }

      if (nodeDef.type === 'bpmn:StartEvent') {
        startEventDef = nodeDef;
      }
    }
    
    if (startEventDef) {
      // create an empty process token
      const processToken: any = await ProcessToken.createEntity(internalContext);
      processToken.process = this;
      if (initialToken) {
        processToken.data = {
          current: initialToken
        };
      }
      // await processToken.save(internalContext);

      const startEvent: IStartEventEntity = <IStartEventEntity>await this.nodeInstanceEntityTypeService.createNode(internalContext, StartEvent);
      startEvent.name = startEventDef.name;
      startEvent.key = startEventDef.key;
      startEvent.process = this;
      startEvent.nodeDef = startEventDef;
      startEvent.type = startEventDef.type;
      startEvent.processToken = processToken;
      startEvent.participant = participant;

      // startEvent.timeStart = Date.now();

      // await startEvent.save(internalContext);

      startEvent.changeState(laneContext, 'start', this);
    }
  }

  public async end(context: ExecutionContext, processToken: any): Promise<void> {
    if (this.isSubProcess) {
      const callerId = this.callerId;

      const source = this;
      const data = {
        action: 'proceed',
        token: processToken.data
      };
      const msg = this.messageBusService.createEntityMessage(data, source, context);
      const channel = '/processengine/node/' + callerId;
      await this.messageBusService.publish(channel, msg);

    }
  }

  public async error(context: ExecutionContext, error): Promise<void> {
    const processToken = null;
    if (this.isSubProcess) {
      const callerId = this.callerId;

      const source = this.getEntityReference().toPojo();
      const data = {
        action: 'event',
        event: 'error',
        data: error
      };
      const msg = this.messageBusService.createEntityMessage(data, source, context);
      const channel = '/processengine/node/' + callerId;
      await this.messageBusService.publish(channel, msg);

    }
    await this.end(context, processToken);
  }

  public addActiveInstance(entity: IEntity): void {
    this._activeInstances[entity.id] = entity;
  }

  public removeActiveInstance(entity: IEntity): void {
    if (this._activeInstances.hasOwnProperty(entity.id)) {
      delete this._activeInstances[entity.id];
    }
  }
}
