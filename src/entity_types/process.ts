import {ExecutionContext, IEntity, IIamService, IInheritedSchema, IPublicGetOptions, SchemaAttributeType } from '@process-engine-js/core_contracts';
import { Entity, EntityDependencyHelper, IEntityType, IPropertyBag } from '@process-engine-js/data_model_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import { ILaneEntity, INodeDefEntity, INodeInstanceEntityTypeService, IParamStart, IProcessDefEntity, IProcessEngineService,
  IProcessEntity, IStartEventEntity } from '@process-engine-js/process_engine_contracts';

import * as debug from 'debug';
const debugInfo = debug('processengine:info');

export class ProcessEntity extends Entity implements IProcessEntity {

  private _iamService: IIamService = undefined;
  private _nodeInstanceEntityTypeService: INodeInstanceEntityTypeService = undefined;
  private _messageBusService: IMessageBusService = undefined;
  private _processEngineService: IProcessEngineService = undefined;

  private _activeInstances: any = {};
  private _allInstances: any = {};
  public boundProcesses: any = {};

  constructor(iamService: IIamService,
              nodeInstanceEntityTypeService: INodeInstanceEntityTypeService,
              messageBusService: IMessageBusService,
              processEngineService: IProcessEngineService,
              entityDependencyHelper: EntityDependencyHelper,
              context: ExecutionContext,
              schema: IInheritedSchema,
              propertyBag: IPropertyBag,
              entityType: IEntityType<IEntity>) {
    super(entityDependencyHelper, context, schema, propertyBag, entityType);

    this._iamService = iamService;
    this._nodeInstanceEntityTypeService = nodeInstanceEntityTypeService;
    this._messageBusService = messageBusService;
    this._processEngineService = processEngineService;
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

  private get processEngineService(): IProcessEngineService {
    return this._processEngineService;
  }

  public async initialize(): Promise<void> {
    await super.initialize(this);
  }

  public get activeInstances(): any {
    return this._activeInstances;
  }

  public get allInstances(): any {
    return this._allInstances;
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

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get status(): string {
    return this.getProperty(this, 'status');
  }

  public set status(value: string) {
    this.setProperty(this, 'status', value);
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
    const participant = params ? params.participant : null;

    const datastoreService = await this.getDatastoreService();
    const processTokenType = await datastoreService.getEntityType('ProcessToken');
    const startEventType = await datastoreService.getEntityType('StartEvent');

    const internalContext: ExecutionContext = await this.iamService.createInternalContext('processengine_system');
    const laneContext = context;

    let applicationId = null;

    this.isSubProcess = isSubProcess;
    this.callerId = (isSubProcess && source) ? source.id : null;
    this.status = 'progress';

    if (this.processDef.persist) {
      await this.save(internalContext, { reloadAfterSave: false });
    }

    if (!isSubProcess) {
      applicationId = source || null;
    }

    const processDef = await this.getProcessDef(internalContext);

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

    // get start event, set lane entities
    let startEventDef: INodeDefEntity;
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

      if (nodeDef.type === 'bpmn:StartEvent') {
        startEventDef = nodeDef;
      }
    }

    if (startEventDef) {
      // create an empty process token
      const processToken: any = await processTokenType.createEntity(internalContext);
      processToken.process = this;
      if (initialToken) {
        processToken.data = {
          current: initialToken,
        };
      }

      if (this.processDef.persist) {
        await processToken.save(internalContext, { reloadAfterSave: false });
      }

      debugInfo(`process id ${this.id} started: `);

      const startEvent: IStartEventEntity = <IStartEventEntity> await this.nodeInstanceEntityTypeService.createNode(internalContext, startEventType);
      startEvent.name = startEventDef.name;
      startEvent.key = startEventDef.key;
      startEvent.process = this;
      startEvent.nodeDef = startEventDef;
      startEvent.type = startEventDef.type;
      startEvent.processToken = processToken;
      startEvent.participant = participant;
      startEvent.application = applicationId;

      startEvent.changeState(laneContext, 'start', this);
    }
  }

  public async end(context: ExecutionContext, processToken: any): Promise<void> {

    // Todo: end active node instances

    const internalContext: ExecutionContext = await this.iamService.createInternalContext('processengine_system');

    if (this.processDef.persist) {
      this.status = 'end';
      await this.save(internalContext, { reloadAfterSave: false });
    }

    if (this.isSubProcess) {
      const callerId = this.callerId;

      const source = this;
      const data = {
        action: 'proceed',
        token: processToken.data,
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

      const source = this;
      const data = {
        action: 'event',
        event: 'error',
        data: error,
      };
      const msg = this.messageBusService.createEntityMessage(data, source, context);
      const channel = '/processengine/node/' + callerId;
      await this.messageBusService.publish(channel, msg);

    }
    await this.end(context, processToken);
  }

  public addActiveInstance(entity: IEntity): void {
    this._activeInstances[entity.id] = entity;
    this._allInstances[entity.id] = entity;
  }

  public removeActiveInstance(entity: IEntity): void {
    if (this._activeInstances.hasOwnProperty(entity.id)) {
      delete this._activeInstances[entity.id];
    }
  }

}
