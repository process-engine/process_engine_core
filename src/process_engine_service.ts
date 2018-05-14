import {
  ExecutionContext,
  IApplicationService,
  IEntity,
  IEntityReference,
  IIamService,
  IPrivateQueryOptions,
  IPublicGetOptions,
  TokenType,
} from '@essential-projects/core_contracts';
import { IDatastoreService, IEntityCollection, IEntityType } from '@essential-projects/data_model_contracts';
import * as ProcessEngineErrors from '@essential-projects/errors_ts';
import { IDataEvent, IEventAggregator, ISubscription } from '@essential-projects/event_aggregator_contracts';
import { IFeature, IFeatureService } from '@essential-projects/feature_contracts';
import {IInvoker, InvocationType} from '@essential-projects/invocation_contracts';
import { IDataMessage, IMessage, IMessageBusService, IMessageSubscription } from '@essential-projects/messagebus_contracts';
import {
  IBpmnDiagram,
  IErrorDeserializer,
  IImportFromFileOptions,
  INodeDefEntity,
  INodeInstanceEntity,
  INodeInstanceEntityTypeService,
  IParamImportFromXml,
  IParamStart,
  IProcessDefEntity,
  IProcessDefEntityTypeService,
  IProcessEngineService,
  IProcessEntity,
  IProcessRepository,
  IUserTaskEntity,
  IUserTaskMessageData,
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
  private _applicationService: IApplicationService = undefined;
  private _invoker: IInvoker = undefined;
  private _errorDeserializer: IErrorDeserializer = undefined;

  private _internalContext: ExecutionContext;
  public config: any = undefined;

  constructor(messageBusService: IMessageBusService,
              eventAggregator: IEventAggregator,
              processDefEntityTypeService: IProcessDefEntityTypeService,
              featureService: IFeatureService,
              iamService: IIamService,
              processRepository: IProcessRepository,
              datastoreService: IDatastoreService,
              nodeInstanceEntityTypeServiceFactory: IFactoryAsync<INodeInstanceEntityTypeService>,
              applicationService: IApplicationService,
              invoker: IInvoker) {
    this._messageBusService = messageBusService;
    this._eventAggregator = eventAggregator;
    this._processDefEntityTypeService = processDefEntityTypeService;
    this._featureService = featureService;
    this._iamService = iamService;
    this._processRepository = processRepository;
    this._datastoreService = datastoreService;
    this._nodeInstanceEntityTypeServiceFactory = nodeInstanceEntityTypeServiceFactory;
    this._applicationService = applicationService;
    this._invoker = invoker;
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

  private get applicationService(): IApplicationService {
    return this._applicationService;
  }

  private get invoker(): IInvoker {
    return this._invoker;
  }

  private get errorDeserializer(): IErrorDeserializer {
    return this._errorDeserializer;
  }

  private async _getInternalContext(): Promise<ExecutionContext> {
    if (!this._internalContext) {
      this._internalContext = await this.iamService.createInternalContext('processengine_system');
    }

    return this._internalContext;
  }

  private _initializeDefaultErrorDeserializer(): void {
    const defaultDeserializer: IErrorDeserializer = (serializedError: string): Error => {

      if (typeof serializedError !== 'string') {
        return serializedError;
      }

      try {
        return ProcessEngineErrors.BaseError.deserialize(serializedError);
      } catch (error) {
        debugErr('an error occured deserializing this error: ', serializedError);
        throw new Error('an error occured during error deserialization');
      }

    };
    this.setErrorDeserializer(defaultDeserializer);
  }

  public async initialize(): Promise<void> {
    this._initializeDefaultErrorDeserializer();
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

  public async getUserTaskData(context: ExecutionContext, userTaskId: string): Promise<IUserTaskMessageData> {
    const nodeInstanceEntityTypeService: INodeInstanceEntityTypeService = await this._getNodeInstanceEntityTypeService();
    const userTaskEntityQueryOptions: IPrivateQueryOptions = {
      expandEntity: [{
        attribute: 'nodeDef',
        childAttributes: [{
          attribute: 'lane',
        }, {
          attribute: 'extensions',
        }],
      }, {
        attribute: 'processToken',
      }],
    };

    const userTaskEntityType: IEntityType<IUserTaskEntity> = await this.datastoreService.getEntityType<IUserTaskEntity>('UserTask');
    const userTask: IUserTaskEntity = await userTaskEntityType.getById(userTaskId, context, userTaskEntityQueryOptions);

    return userTask.getUserTaskData(context);
  }

  public async createBpmnFromXml(context: ExecutionContext, xml: string, name: string): Promise<IProcessDefEntity> {
    const bpmnDiagram: IBpmnDiagram = await this.processDefEntityTypeService.parseBpmnXml(xml);
    const processDef: IEntityType<IProcessDefEntity> = await this.datastoreService.getEntityType<IProcessDefEntity>('ProcessDef');
    const processes: Array<any> = bpmnDiagram.getProcesses();

    if (processes.length === 0) {
      throw new Error('Model must contain a process');
    }

    const nameIsInvalid: boolean = (name === undefined);
    const diagramName: string = nameIsInvalid ? processes[0].name : name;
    const diagramKey: string = nameIsInvalid ? processes[0].id : name;

    if (name !== undefined) {
      xml = xml
              .replace(`id="${processes[0].id}"`, `id="${name}"`)
              .replace(`processRef="${processes[0].id}"`, `processRef="${name}"`);
    }

    await this.processDefEntityTypeService.importBpmnFromXml(context, {name: diagramName, xml: xml});
    const queryObject: IPrivateQueryOptions = {
      query: {
        attribute: 'key',
        operator: '=',
        value: diagramKey,
      },
    };

    const processDefEntity: IProcessDefEntity = await processDef.findOne(context, queryObject);

    return processDefEntity.toPojo(context);
  }

  // tslint:disable-next-line:cyclomatic-complexity
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

  private async handleProcessEngineMessage(message: IDataMessage): Promise<void> {
    if (message.data.event === 'executeProcess') {
      const responseChannel: string = message.metadata.response;
      await this.messageBusService.verifyMessage(message);
      const responseData: any = await this.executeProcess(message.metadata.context,
                                                          message.data.id,
                                                          message.data.key,
                                                          message.data.initialToken,
                                                          message.data.version);

      const responseMessage: IMessage = this.messageBusService.createDataMessage(responseData, message.metadata.context);
      this.messageBusService.publish(responseChannel, responseMessage);
    }

    if (message.data.event === 'createProcessInstance') {
      const responseChannel: string = message.metadata.response;
      await this.messageBusService.verifyMessage(message);
      const responseData: any = await this.createProcessInstance(message.metadata.context,
                                                          message.data.id,
                                                          message.data.key,
                                                          message.data.version);

      const responseMessage: IMessage = this.messageBusService.createDataMessage(responseData, message.metadata.context);
      this.messageBusService.publish(responseChannel, responseMessage);
    }
    if (message.data.event === 'getInstanceId') {
      const responseChannel: string = message.metadata.response;
      const responseMessage: IMessage = this.messageBusService.createDataMessage({
        instanceId: this.applicationService.instanceId,
      }, null);
      this.messageBusService.publish(responseChannel, responseMessage);
    }
  }

  private async _initializeMessageBus(): Promise<void> {

    try {

      this.messageBusService.subscribe(`/processengine/${this.applicationService.id}`, (message: IDataMessage) => {
        this.handleProcessEngineMessage(message);
      });

      this.messageBusService.subscribe(`/processengine/${this.applicationService.instanceId}`, (message: IDataMessage) => {
        this.handleProcessEngineMessage(message);
      });

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
      overwriteExisting: true,
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
    return new Promise((resolve: Function, reject: Function): void => {
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

  public async executeProcess(context: ExecutionContext, id: string, key: string, initialToken: any, version?: string): Promise<any> {
    if (id === undefined && key === undefined) {
      throw new Error(`Couldn't execute process: neither id nor key of processDefinition is provided`);
    }

    let processDefinition: IProcessDefEntity;
    if (id !== undefined) {
      processDefinition = await this.processDefEntityTypeService.getProcessDefinitionById(context, id, version);
    } else {
      processDefinition = await this.processDefEntityTypeService.getProcessDefinitionByKey(context, key, version);
    }

    if (!processDefinition) {
      throw new Error(`couldn't execute process: no processDefinition with key ${key} or id ${id} was found`);
    }

    const requiredFeatures: Array<IFeature> = processDefinition.features;
    const canStartProcessLocally: boolean = requiredFeatures === undefined
                               || requiredFeatures.length === 0
                               || this.featureService.hasFeatures(requiredFeatures);

    if (canStartProcessLocally) {
      return this._executeProcessLocally(context, processDefinition, initialToken);
    }

    return this._executeProcessRemotely(context, requiredFeatures, id, key, initialToken, version);
  }

  public async executeProcessInstance(context: ExecutionContext, processInstanceId: string, participantId: string, initialToken: any): Promise<any> {
    const processEntityType: IEntityType<IProcessEntity> = await this.datastoreService.getEntityType<IProcessEntity>('Process');

    const processInstance: IProcessEntity = await processEntityType.getById(processInstanceId, context);
    const processDefinition: IProcessDefEntity = await processInstance.getProcessDef(context);

    const requiredFeatures: Array<IFeature> = processDefinition.features;
    const canStartProcessLocally: boolean = requiredFeatures === undefined
                                || requiredFeatures.length === 0
                                || this.featureService.hasFeatures(requiredFeatures);

    if (canStartProcessLocally) {
      return this._executeProcessInstanceLocally(context, processInstance, participantId, initialToken);
    }

    return this._executeProcessInstanceRemotely(context, requiredFeatures, processInstanceId, participantId, initialToken);
  }

  public async createProcessInstance(context: ExecutionContext, processDefId: string, key: string, version?: string): Promise<string> {
    if (processDefId === undefined && key === undefined) {
      throw new Error(`Couldn't execute process: neither id nor key of processDefinition is provided`);
    }

    let processDefinition: IProcessDefEntity;
    if (processDefId !== undefined) {
      processDefinition = await this.processDefEntityTypeService.getProcessDefinitionById(context, processDefId, version);
    } else {
      processDefinition = await this.processDefEntityTypeService.getProcessDefinitionByKey(context, key, version);
    }

    if (!processDefinition) {
      throw new Error(`couldn't execute process: no processDefinition with key ${key} or id ${processDefId} was found`);
    }

    const requiredFeatures: Array<IFeature> = processDefinition.features;
    const canStartProcessLocally: boolean = requiredFeatures === undefined
                               || requiredFeatures.length === 0
                               || this.featureService.hasFeatures(requiredFeatures);

    if (canStartProcessLocally) {
      const processInstance: IProcessEntity = await processDefinition.createProcessInstance(context);

      await processInstance.save(context);

      return processInstance.id;
    }

    return this._createProcessInstanceRemotely(context, requiredFeatures, processDefId, key, version);
  }

  public setErrorDeserializer(deserializer: IErrorDeserializer): void {
    this._errorDeserializer = deserializer;
  }

  private _executeProcessLocally(context: ExecutionContext, processDefinition: IProcessDefEntity, initialToken: any): Promise<any> {
    return new Promise(async(resolve: Function, reject: Function): Promise<void> => {

      const processInstance: IProcessEntity = await processDefinition.createProcessInstance(context);
      const processInstanceChannel: string = `/processengine/process/${processInstance.id}`;

      const processEndSubscription: IMessageSubscription = await this.messageBusService.subscribe(processInstanceChannel, (message: IDataMessage) => {

        if (message.data.event === 'error') {

          if (!this.errorDeserializer) {
            throw new Error('error deserializer not found.');
          }

          let finalError: any;

          if (message.data.data.serializedError) {
            finalError = this.errorDeserializer(message.data.data.serializedError);
          } else {
            finalError = message.data.data.error;
          }

          reject(finalError);
          processEndSubscription.cancel();

          return;
        }

        if (message.data.event === 'terminate') {
          debugErr(`Unexpected process termination through TerminationEndEvent '${message.data.endEventKey}'!`);

          return reject(new Error(`The process was terminated through the '${message.data.endEventKey}' TerminationEndEvent!`));
        }

        if (message.data.event !== 'end') {
          return;
        }

        resolve(message.data.token);
        processEndSubscription.cancel();
      });

      await this.invoker.invoke(processInstance, 'start', undefined, context, context, {
        initialToken: initialToken,
      });
    });
  }

  private _executeProcessInstanceLocally(context: ExecutionContext,
                                         processInstance: IProcessEntity,
                                         participantId: string,
                                         initialToken: any): Promise<any> {

    return new Promise(async(resolve: Function, reject: Function): Promise<void> => {

      const processInstanceChannel: string = `/processengine/process/${processInstance.id}`;
      const processEndSubscription: IMessageSubscription = await this.messageBusService.subscribe(processInstanceChannel, (message: IDataMessage) => {

        if (message.data.event === 'error') {

          if (!this.errorDeserializer) {
            throw new Error('error deserializer not found.');
          }

          const deserializedError: Error = this.errorDeserializer(message.data.data);
          reject(deserializedError);
          processEndSubscription.cancel();

          return;
        }

        if (message.data.event === 'terminate') {
          debugErr(`Unexpected process termination through TerminationEndEvent '${message.data.endEventKey}'!`);

          return reject(new Error(`The process was terminated through the '${message.data.endEventKey}' TerminationEndEvent!`));
        }

        if (message.data.event !== 'end') {
          return;
        }

        resolve(message.data.token);
        processEndSubscription.cancel();
      });

      await this.invoker.invoke(processInstance, 'start', undefined, context, context, {
        initialToken: initialToken,
        participant: participantId,
      });
    });
  }

  private async _executeProcessRemotely(context: ExecutionContext,
                                        requiredFeatures: Array<IFeature>,
                                        id: string,
                                        key: string,
                                        initialToken: any,
                                        version?: string): Promise<any> {
    const possibleRemoteTargets: Array<string> = this.featureService.getApplicationIdsByFeatures(requiredFeatures);
    if (possibleRemoteTargets.length === 0) {
      // tslint:disable-next-line:max-line-length
      throw new Error(`couldn't execute process: the process-engine instance doesn't have the required features to execute the process, and does not know of any other process-engine that does`);
    }

    const getInstanceIdMessage: IDataMessage = this.messageBusService.createDataMessage({
      event: 'getInstanceId',
    }, null);

    const executeProcessMessage: IDataMessage = this.messageBusService.createDataMessage({
      event: 'executeProcess',
      id: id,
      key: key,
      initialToken: initialToken,
      version: version,
    }, context);

    const targetApplicationChannel: string = `/processengine/${possibleRemoteTargets[0]}`;
    const target: IDataMessage = <IDataMessage> await this.messageBusService.request(targetApplicationChannel, getInstanceIdMessage);
    const targetInstanceChannel: string = `/processengine/${target.data.instanceId}`;
    const executeProcessResponse: IDataMessage = <IDataMessage> await this.messageBusService.request(targetInstanceChannel, executeProcessMessage);

    return executeProcessResponse.data;
  }

  private async _executeProcessInstanceRemotely(context: ExecutionContext,
                                                requiredFeatures: Array<IFeature>,
                                                processInstanceId: string,
                                                participantId: string,
                                                initialToken: any): Promise<any> {
    const possibleRemoteTargets: Array<string> = this.featureService.getApplicationIdsByFeatures(requiredFeatures);
    if (possibleRemoteTargets.length === 0) {
      // tslint:disable-next-line:max-line-length
      throw new Error(`couldn't execute process: the process-engine instance doesn't have the required features to execute the process, and does not know of any other process-engine that does`);
    }

    const getInstanceIdMessage: IDataMessage = this.messageBusService.createDataMessage({
      event: 'getInstanceId',
    }, null);

    const executeProcessInstanceMessage: IDataMessage = this.messageBusService.createDataMessage({
      event: 'executeProcessInstance',
      processInstanceId: processInstanceId,
      initialToken: initialToken,
      participantId: participantId,
    }, context);

    const targetApplicationChannel: string = `/processengine/${possibleRemoteTargets[0]}`;
    const target: IDataMessage = <IDataMessage> await this.messageBusService.request(targetApplicationChannel, getInstanceIdMessage);
    const targetInstanceChannel: string = `/processengine/${target.data.instanceId}`;
    const executeProcessInstanceResponse: IDataMessage =
      <IDataMessage> await this.messageBusService.request(targetInstanceChannel, executeProcessInstanceMessage);

    return executeProcessInstanceResponse.data;
  }

  private async _createProcessInstanceRemotely(context: ExecutionContext,
                                               requiredFeatures: Array<IFeature>,
                                               id: string,
                                               key: string,
                                               version?: string): Promise<any> {
    const possibleRemoteTargets: Array<string> = this.featureService.getApplicationIdsByFeatures(requiredFeatures);
    if (possibleRemoteTargets.length === 0) {
    // tslint:disable-next-line:max-line-length
      throw new Error(`couldn't create process: the process-engine instance doesn't have the required features to execute the process, and does not know of any other process-engine that does`);
    }

    const getInstanceIdMessage: IDataMessage = this.messageBusService.createDataMessage({
      event: 'getInstanceId',
    }, null);

    const executeProcessMessage: IDataMessage = this.messageBusService.createDataMessage({
      event: 'createProcess',
      id: id,
      key: key,
      version: version,
    }, context);

    const targetApplicationChannel: string = `/processengine/${possibleRemoteTargets[0]}`;
    const target: IDataMessage = <IDataMessage> await this.messageBusService.request(targetApplicationChannel, getInstanceIdMessage);
    const targetInstanceChannel: string = `/processengine/${target.data.instanceId}`;
    const createProcessResponse: IDataMessage = <IDataMessage> await this.messageBusService.request(targetInstanceChannel, executeProcessMessage);

    return createProcessResponse.data;
  }

}
