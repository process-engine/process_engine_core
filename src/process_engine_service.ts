import { IProcessRepository, IProcessEngineService, IProcessDefEntityTypeService, IParamStart, IImportFromFileOptions, IParamImportFromXml } from '@process-engine-js/process_engine_contracts';
import { IMessageBusService } from '@process-engine-js/messagebus_contracts';
import { ExecutionContext, IPublicGetOptions, IIamService, IEntityReference, IFactory } from '@process-engine-js/core_contracts';
import { IFeatureService } from '@process-engine-js/feature_contracts';
import { IEventAggregator } from '@process-engine-js/event_aggregator_contracts';
import { IDatastoreService } from '@process-engine-js/data_model_contracts';

import * as debug from 'debug';

const debugInfo = debug('process_engine:info');
const debugErr = debug('process_engine:error');


export class ProcessEngineService implements IProcessEngineService {

  private _messageBusService: IMessageBusService = undefined;
  private _eventAggregator: IEventAggregator = undefined;
  private _processDefEntityTypeService: IProcessDefEntityTypeService = undefined;
  private _featureService: IFeatureService = undefined;
  private _iamService: IIamService = undefined;
  private _processRepository: IProcessRepository = undefined;
  private _datastoreService: IDatastoreService = undefined;
  private _datastoreServiceFactory: IFactory<IDatastoreService> = undefined;

  private _runningProcesses: any = {};
  private _processTokenCache: any = {};

  public config: any = undefined;

  constructor(messageBusService: IMessageBusService, eventAggregator: IEventAggregator, processDefEntityTypeService: IProcessDefEntityTypeService, featureService: IFeatureService, iamService: IIamService, processRepository: IProcessRepository, datastoreServiceFactory: IFactory<IDatastoreService>) {
    this._messageBusService = messageBusService;
    this._eventAggregator = eventAggregator;
    this._processDefEntityTypeService = processDefEntityTypeService;
    this._featureService = featureService;
    this._iamService = iamService;
    this._processRepository = processRepository;
    this._datastoreServiceFactory = datastoreServiceFactory;
  }

  private get messageBusService(): IMessageBusService {
    return this._messageBusService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get processDefEntityTypeService(): IProcessDefEntityTypeService {
    return this._processDefEntityTypeService;
  }

  private get featureService(): IFeatureService {
    return this._featureService;
  }

  private get iamService(): IIamService {
    return this._iamService;
  }

  private get processRepository(): IProcessRepository {
    return this._processRepository;
  }

  private get datastoreService(): IDatastoreService {
    if (!this._datastoreService) {
      this._datastoreService = this._datastoreServiceFactory();
    }
    return this._datastoreService;
  }

  private get runningProcesses(): any {
    return this._runningProcesses;
  }

  private get processTokenCache(): any {
    return this._processTokenCache;
  }

  public async initialize(): Promise<void> {
    this.featureService.initialize();
    await this._initializeMessageBus();
    await this._initializeProcesses();
    await this._startTimers();
  }

  public async start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<string> {
    const processEntity: IEntityReference = await this.processDefEntityTypeService.start(context, params, options);
    this.runningProcesses[processEntity.id] = processEntity;
    return processEntity.id;
  }

  private async _messageHandler(msg): Promise<void> {
    debugInfo('we got a message: ', msg);

    await this.messageBusService.verifyMessage(msg);
    
    const action: string = (msg && msg.data && msg.data.action) ? msg.data.action : null;
    const key: string = (msg && msg.data && msg.data.key) ? msg.data.key : null;
    const initialToken: any = (msg && msg.data && msg.data.token) ? msg.data.token : null;
    let source: any = (msg && msg.metadata && msg.metadata.applicationId) ? msg.metadata.applicationId : null;
    
    // fallback to old origin
    if (!source) {
      source = (msg && msg.origin && msg.origin.id) ? msg.origin.id : null;
    }
    const isSubProcess: boolean = (msg && msg.data && msg.data.isSubProcess) ? msg.data.isSubProcess : false;

    const context = (msg && msg.metadata && msg.metadata.context) ? msg.metadata.context : {};

    switch (action) {
      case 'start':

        const params: IParamStart = {
          key: key,
          initialToken: initialToken,
          source: source,
          isSubProcess: isSubProcess
        };

        const processEntity = await this.processDefEntityTypeService.start(context, params);
        debugInfo(`process id ${processEntity.id} started: `);
        break;
      default:
        debugInfo('unhandled action: ', msg);
        break;
    }
  }

  private async _initializeMessageBus(): Promise<void> {
    
    try {

      // Todo: we subscribe on the old channel to leave frontend intact
      // this is deprecated and should be replaced with the new datastore api
      if (this.messageBusService.isMaster) {
        await this.messageBusService.subscribe(`/processengine`, this._messageHandler.bind(this));
        debugInfo(`subscribed on Messagebus Master`);
      }

    } catch (err) {
      debugErr('subscription failed on Messagebus', err.message);
      throw new Error(err.message);
    }
  }

  private async _initializeProcesses(): Promise<void> {

    const internalContext = await this.iamService.createInternalContext('processengine_system');
    const options: IImportFromFileOptions = {
      overwriteExisting: true
    };

    this.processRepository.initialize();

    const processes = this.processRepository.getProcessesByCategory('internal');

    for (let i = 0; i < processes.length; i++) {

        const process = processes[i];

        const params: IParamImportFromXml = {
          xml: process.bpmnXml,
          internalName: process.name,
          category: process.category,
          module: process.module,
          path: process.path,
          readonly: process.readonly
        };

        await this.processDefEntityTypeService.importBpmnFromXml(internalContext, params, options);
    }
  }


  private async _startTimers(): Promise<void> {

    const internalContext = await this.iamService.createInternalContext('processengine_system');

    const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
    const queryObject = {
          operator: 'and',
          queries: [
            { attribute: 'type', operator: '=', value: 'bpmn:StartEvent' },
            { attribute: 'eventType', operator: '=', value: 'bpmn:TimerEventDefinition' }
          ]
        };
    const startEventColl: any = await nodeDefEntityType.query(internalContext, { query: queryObject });

    startEventColl.each(internalContext, async (nodeDef) => {
      const processDef = await nodeDef.getProcessDef(internalContext);
      await processDef.startTimer(internalContext);
    });
    
  }

}
