import {ExecutionContext, SchemaAttributeType, IEntity, IPublicGetOptions} from '@process-engine-js/core_contracts';
import { Entity, EntityDependencyHelper, IDatastoreService} from '@process-engine-js/data_model_contracts';
import { IProcessEntity, IProcessDefEntity, IParamStart, IProcessTokenEntity, IStartEventEntity, INodeInstanceEntityTypeService} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import { IIamService } from '@process-engine-js/iam_contracts';

export class ProcessEntity extends Entity implements IProcessEntity {

  private _iamService: IIamService = undefined;
  private _nodeInstanceEntityTypeService: INodeInstanceEntityTypeService = undefined;

  constructor(iamService: IIamService, nodeInstanceEntityTypeService: INodeInstanceEntityTypeService, entityDependencyHelper: EntityDependencyHelper) {
    super(entityDependencyHelper);

    this._iamService = iamService;
    this._nodeInstanceEntityTypeService = nodeInstanceEntityTypeService;
  }

  private get iamService(): IIamService {
    return this._iamService;
  }

  private get nodeInstanceEntityTypeService(): INodeInstanceEntityTypeService {
    return this._nodeInstanceEntityTypeService;
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


  @schemaAttribute({ type: 'ProcessDef' })
  public get processDef(): IProcessDefEntity {
    return this.getProperty(this, 'processDef');
  }

  public set processDef(value: IProcessDefEntity) {
    this.setProperty(this, 'processDef', value);
  }

  public getProcessDef(): Promise<IProcessDefEntity> {
    return this.getPropertyLazy(this, 'processDef');
  }

  public async start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<void> {
    
    const source = params ? params.source : undefined;
    const initialToken = params ? params.initialToken : undefined;

    const ProcessToken = await this.datastoreService.getEntityType('ProcessToken');
    const NodeDef = await this.datastoreService.getEntityType('NodeDef');
    const StartEvent = await this.datastoreService.getEntityType('StartEvent');

    const internalContext: ExecutionContext = await this.iamService.createInternalContext('processengine_system');
    let laneContext = context;

    // Todo: handle source as parent process
    const participant = (source && source.id) ? source.id : null;

    const processDef = await this.getProcessDef();
    // get start event
    const queryObject = [
      { attribute: 'type', operator: '=', value: 'bpmn:StartEvent' },
      { attribute: 'processDef', operator: '=', value: processDef.id }
    ];
    const startEventDef: any = await NodeDef.findOne(internalContext, { query: queryObject });

    if (startEventDef) {
      // create an empty process token
      const processToken: any = await ProcessToken.createEntity(internalContext);
      processToken.process = this;
      if (initialToken) {
        processToken.data = {
          current: initialToken
        };
      }
      await processToken.save(internalContext);

      const startEvent: IStartEventEntity = <IStartEventEntity>await this.nodeInstanceEntityTypeService.createNode(internalContext, StartEvent);
      startEvent.name = startEventDef.name;
      startEvent.key = startEventDef.key;
      startEvent.process = this;
      startEvent.nodeDef = startEventDef;
      startEvent.type = startEventDef.type;
      startEvent.processToken = processToken;
      startEvent.participant = participant;

      // startEvent.timeStart = Date.now();

      await startEvent.save(internalContext);

      await startEvent.changeState(laneContext, 'start', this);
    }
  }
}
