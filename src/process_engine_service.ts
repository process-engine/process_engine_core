import {
  ExecutionContext,
  IEntity,
  IEntityReference,
  IIamService,
  IPrivateQueryOptions,
  IPublicGetOptions,
} from '@essential-projects/core_contracts';
import { IDatastoreService, IEntityCollection, IEntityType } from '@essential-projects/data_model_contracts';
import { IEventAggregator } from '@essential-projects/event_aggregator_contracts';
import { IFeatureService } from '@essential-projects/feature_contracts';
import { IMessage, IMessageBusService } from '@essential-projects/messagebus_contracts';
import {
  IImportFromFileOptions,
  INodeDefEntity,
  INodeInstanceEntity,
  INodeInstanceEntityTypeService,
  IParamImportFromXml,
  IParamStart,
  IProcessDefEntityTypeService,
  IProcessEngineService,
  IProcessEntity,
  IProcessRepository,
} from '@process-engine/process_engine_contracts';
import {IFactoryAsync} from 'addict-ioc';

import * as debug from 'debug';

const debugInfo = debug('processengine:info');
const debugErr = debug('processengine:error');

export class ProcessEngineService implements IProcessEngineService {

  private _messageBusService: IMessageBusService = undefined;
  private _eventAggregator: IEventAggregator = undefined;
  private _processDefEntityTypeService: IProcessDefEntityTypeService = undefined;
  private _featureService: IFeatureService = undefined;
  private _iamService: IIamService = undefined;
  private _processRepository: IProcessRepository = undefined;
  private _datastoreService: IDatastoreService = undefined;
  private _nodeInstanceEntityTypeServiceFactory: IFactoryAsync<INodeInstanceEntityTypeService> = undefined;
  private _nodeInstanceEntityTypeService: INodeInstanceEntityTypeService = undefined;

  public config: any = undefined;

  constructor(messageBusService: IMessageBusService,
              eventAggregator: IEventAggregator,
              processDefEntityTypeService: IProcessDefEntityTypeService,
              featureService: IFeatureService,
              iamService: IIamService,
              processRepository: IProcessRepository,
              datastoreService: IDatastoreService,
              nodeInstanceEntityTypeServiceFactory: IFactoryAsync<INodeInstanceEntityTypeService>) {
    this._messageBusService = messageBusService;
    this._eventAggregator = eventAggregator;
    this._processDefEntityTypeService = processDefEntityTypeService;
    this._featureService = featureService;
    this._iamService = iamService;
    this._processRepository = processRepository;
    this._datastoreService = datastoreService;
    this._nodeInstanceEntityTypeServiceFactory = nodeInstanceEntityTypeServiceFactory;
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
    return this._datastoreService;
  }

  private async _getNodeInstanceEntityTypeService(): Promise<INodeInstanceEntityTypeService> {
    if (!this._nodeInstanceEntityTypeService) {
      this._nodeInstanceEntityTypeService = await this._nodeInstanceEntityTypeServiceFactory();
    }

    return this._nodeInstanceEntityTypeService;
  }

  public async initialize(): Promise<void> {
    await this._initializeMessageBus();
    await this._initializeProcesses();
    await this._startTimers();
    return this._continueOwnProcesses();
  }

  public async start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<string> {
    const processEntity: IEntityReference = await this.processDefEntityTypeService.start(context, params, options);
    return processEntity.id;
  }

  private async _messageHandler(msg): Promise<void> {
    debugInfo('we got a message: ', msg);

    await this.messageBusService.verifyMessage(msg);

    const action: string = (msg && msg.data && msg.data.action) ? msg.data.action : null;
    const key: string = (msg && msg.data && msg.data.key) ? msg.data.key : null;
    const initialToken: any = (msg && msg.data && msg.data.token) ? msg.data.token : null;
    let source: any = (msg && msg.metadata && msg.metadata.applicationId) ? msg.metadata.applicationId : null;
    const participant = (msg && msg.metadata && msg.metadata.options && msg.metadata.options.participantId) ? msg.metadata.options.participantId : null;

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
          isSubProcess: isSubProcess,
          participant: participant,
        };

        await this.processDefEntityTypeService.start(context, params);

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
        this.messageBusService.subscribe(`/processengine`, this._messageHandler.bind(this));
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
      overwriteExisting: false,
    };

    const processes = this.processRepository.getProcessesByCategory('internal');
    for (let i = 0; i < processes.length; i++) {

        const process = processes[i];

        const params: IParamImportFromXml = {
          xml: process.bpmnXml,
          internalName: process.name,
          category: process.category,
          module: process.module,
          path: process.path,
          readonly: process.readonly,
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
            { attribute: 'eventType', operator: '=', value: 'bpmn:TimerEventDefinition' },
          ],
        };
    const startEventColl: any = await nodeDefEntityType.query(internalContext, { query: queryObject });

    startEventColl.each(internalContext, async(nodeDef) => {
      const processDef = await nodeDef.getProcessDef(internalContext);
      await processDef.startTimer(internalContext);
    });
  }

  private async _continueOwnProcesses(): Promise<any> {
    const internalContextPromise: Promise<ExecutionContext> = this.iamService.createInternalContext('processengine_system');
    const nodeInstanceEntityTypePromise: Promise<IEntityType<INodeInstanceEntity>> = this.datastoreService.getEntityType('NodeInstance');
    const internalContext: ExecutionContext = await internalContextPromise;
    const nodeInstanceEntityType: IEntityType<INodeInstanceEntity> = await nodeInstanceEntityTypePromise;

    const queryObject: IPrivateQueryOptions = {
      query: {
        attribute: 'state',
        operator: '=',
        value: 'wait',
      },
      expandCollection: [{
        attribute: 'nodeDef',
        childAttributes: [{ attribute: 'lane' }],
      }, {
        attribute: 'processToken',
      }],
    };
    const allRunningNodesCollection: IEntityCollection<INodeInstanceEntity> = await nodeInstanceEntityType.query(internalContext, queryObject);
    const allRunningNodes: Array<INodeInstanceEntity> = [];
    debugInfo(allRunningNodesCollection);
    await allRunningNodesCollection.each(internalContext, (nodeInstance: INodeInstanceEntity) => {
      allRunningNodes.push(nodeInstance);
    });

    return Promise.all<void>(allRunningNodes.map((runningNode: INodeInstanceEntity) => {
      return this._continueOwnProcess(internalContext, runningNode);
    }));
  }

  private async _continueOwnProcess(context: ExecutionContext, runningNode: INodeInstanceEntity): Promise<any> {
      const checkMessageData: any = {
        action: 'checkResponsibleInstance',
      };

      const checkMessage: IMessage = this.messageBusService.createDataMessage(checkMessageData, context);
      debugInfo(runningNode.id);
      try {
        await this.messageBusService.request(`/processengine/node/${runningNode.id}`, checkMessage);

        return;
      } catch (error) {
        if (error.message !== 'request timed out') {
          throw error;
        }
      }

      // the request didn't return, wich means it error'd, but it also didn't rethrow the error,
      // which means it error'd, because the request timed out. This in turn means, that no one
      // answered to our 'checkResponsibleInstance'-request, which means that no one is responsible
      // for that process. This means, that we can safely claim responsibility and continue running
      // the process that belongs to the node

      const nodeInstanceEntityTypeService: INodeInstanceEntityTypeService = await this._getNodeInstanceEntityTypeService();
      const specificEntityTypePromise: Promise<IEntityType<INodeInstanceEntity>> = nodeInstanceEntityTypeService.getEntityTypeFromBpmnType<INodeInstanceEntity>(runningNode.type);
      const processPromise: Promise<IProcessEntity> = runningNode.getProcess(context);

      const process: IProcessEntity = await processPromise;
      const specificEntityType: IEntityType<INodeInstanceEntity> = await specificEntityTypePromise;

      const processInitializePromise: Promise<INodeDefEntity> = process.initializeProcess();
      const specificEntityPromise: Promise<INodeInstanceEntity> = specificEntityType.getById(runningNode.id, context, {
        expandEntity: [{
          attribute: 'process',
        }],
      });

      await processInitializePromise;
      const specificEntity: INodeInstanceEntity = await specificEntityPromise;

      // TODO: Here'd we have to check, if we have the features required to continue the execution
      // and delegate the execution if we don't. See https://github.com/process-engine/process_engine/issues/2
      nodeInstanceEntityTypeService.subscibeToNodeChannels(specificEntity);
      // runningNode.changeState(context, 'start', null);
  }

}
