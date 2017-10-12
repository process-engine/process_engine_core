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
import { IMessage, IMessageBusService, IMessageSubscription } from '@essential-projects/messagebus_contracts';
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

  private _internalContext: ExecutionContext;
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

  private async _getInternalContext(): Promise<ExecutionContext> {
    if (!this._internalContext) {
      this._internalContext = await this.iamService.createInternalContext('processengine_system');
    }

    return this._internalContext;
  }

  public async initialize(): Promise<void> {
    await this._initializeMessageBus();
    await this._initializeProcesses();
    await this._startTimers();

    // do not await this! continuing the waiting processes requires the messagebus
    // to be fully initialized and started. Because of how the messagebus hooks into
    // the http-server, it only starts after the initialize-lifecycle has been fully
    // completed. If we were to await here, it would wait for the messagebus to start
    // before continuing the initialize-lifecycle, which in turn would never finish,
    // because the messagebus only ever starts after the initialize-lifecycle
    this._continueOwnProcesses();
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

    const [
      allWaitingNodes,
      internalContext,
    ] = await Promise.all([
      this._getAllWaitingNodes(),
      this._getInternalContext(),
    ]);

    if (allWaitingNodes.length === 0) {
      return;
    }

    await this._waitForMessagebus();

    return Promise.all<void>(allWaitingNodes.map((runningNode: INodeInstanceEntity) => {
      return this._continueOwnProcess(internalContext, runningNode);
    }));
  }

  private async _continueOwnProcess(context: ExecutionContext, waitingNode: INodeInstanceEntity): Promise<any> {

    debugInfo(`Checking, if node ${waitingNode.id} is abandoned`);
    if (await this._nodeAlreadyBelongsToOtherProcessEngine(context, waitingNode)) {
      debugInfo(`node ${waitingNode.id} is not abandoned`);

      return;
    }
    debugInfo(`node ${waitingNode.id} is indeed abandoned. Taking over responsibility`);

    const specificEntity: INodeInstanceEntity = await this._getSpecificEntityByNodeInstance(context, waitingNode);
    const processToContinue: IProcessEntity = await specificEntity.getProcess(context);
    await processToContinue.initializeProcess();

    // TODO: Here'd we have to check, if we have the features required to continue the execution
    // and delegate the execution if we don't. See https://github.com/process-engine/process_engine/issues/2
    const nodeInstanceEntityTypeService: INodeInstanceEntityTypeService = await this._getNodeInstanceEntityTypeService();
    nodeInstanceEntityTypeService.subscibeToNodeChannels(specificEntity);
  }

  private async _getAllWaitingNodes(): Promise<Array<INodeInstanceEntity>> {
    const [
      internalContext,
      nodeInstanceEntityType,
    ] = await Promise.all([
      this._getInternalContext(),
      this.datastoreService.getEntityType<INodeInstanceEntity>('NodeInstance'),
    ]);

    const waitingNodesQuery: IPrivateQueryOptions = {
      query: {
        attribute: 'state',
        operator: '=',
        value: 'wait',
      },
    };

    const allWaitingNodesCollection: IEntityCollection<INodeInstanceEntity> = await nodeInstanceEntityType.query(internalContext, waitingNodesQuery);
    debugInfo(`There are ${allWaitingNodesCollection.length} potentially abandoned nodeInstances`);
    const allWaitingNodes: Array<INodeInstanceEntity> = [];
    await allWaitingNodesCollection.each(internalContext, (nodeInstance: INodeInstanceEntity) => {
      allWaitingNodes.push(nodeInstance);
    });

    return allWaitingNodes;
  }

  private async _nodeAlreadyBelongsToOtherProcessEngine(context: ExecutionContext, node: INodeInstanceEntity): Promise<boolean> {
    const checkMessageData: any = {
      action: 'checkResponsibleInstance',
    };

    const checkMessage: IMessage = this.messageBusService.createDataMessage(checkMessageData, context);

    try {
      await this.messageBusService.request(`/processengine/node/${node.id}`, checkMessage);

      return true;
    } catch (error) {
      if (error.message !== 'request timed out') {
        throw error;
      }
    }

    // the request didn't return, wich means it error'd, but it also didn't rethrow the error,
    // which means it error'd, because the request timed out. This in turn means, that no one
    // answered to our 'checkResponsibleInstance'-request, which means that no one is responsible
    // for that process
    return false;
  }

  // When we only have the general NodeInstanceEntity, but what we want the specific entity that represents that nodeInstace
  // (for example the UserTaskEntity), then this method gives us that specific entity
  private async _getSpecificEntityByNodeInstance(context: ExecutionContext, nodeInstance: INodeInstanceEntity): Promise<INodeInstanceEntity> {
    const nodeInstanceEntityTypeService: INodeInstanceEntityTypeService = await this._getNodeInstanceEntityTypeService();
    const specificEntityQueryOptions: IPrivateQueryOptions = {
      expandEntity: [{
        attribute: 'nodeDef',
        childAttributes: [{
          attribute: 'lane',
        }],
      }, {
        attribute: 'processToken',
      }],
    };

    // tslint:disable-next-line:max-line-length
    const specificEntityType: IEntityType<INodeInstanceEntity> = await nodeInstanceEntityTypeService.getEntityTypeFromBpmnType<INodeInstanceEntity>(nodeInstance.type);

    return specificEntityType.getById(nodeInstance.id, context, specificEntityQueryOptions);
  }

  private _timeoutPromise(milliseconds: number): Promise<void> {
    return new Promise((resolve: any, reject: any) => {
      setTimeout(() => {
        resolve();
      }, milliseconds);
    });
  }

  private async _waitForMessagebus(): Promise<void> {
    // make sure the messagebus-adapter is ready
    const initSubscription: IMessageSubscription = await this.messageBusService.subscribe(`/processengine/bootup`, null);
    initSubscription.dispose();

    if (this.messageBusService.isMaster) {
      debugInfo(`This instance is messagebus-master. Giving clients 15 seconds time to connect now.`);
      // give everyone some time to connect
      const defaultclientConnectTime: number = 15000;
      const clientConnectTime: number = this.config.messagebusClientConnectTime || defaultclientConnectTime;
      await this._timeoutPromise(clientConnectTime);
    }
  }

}
