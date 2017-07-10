import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema, IQueryObject, IPrivateQueryOptions,
  IPublicGetOptions, ICombinedQueryClause, IEntityReference, IPrivateSaveOptions} from '@process-engine-js/core_contracts';
import {Entity, EntityDependencyHelper, EntityCollection, EntityReference} from '@process-engine-js/data_model_contracts';
import { IProcessDefEntityTypeService, BpmnDiagram, IProcessDefEntity, IParamUpdateDefs, IParamStart, IProcessEntity,
  IProcessRepository, TimerDefinitionType} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {ITimingService, ITimingRule} from '@process-engine-js/timing_contracts';
import {IEventAggregator} from '@process-engine-js/event_aggregator_contracts';
import { IFeature, IFeatureService } from '@process-engine-js/feature_contracts';
import { IDatastoreMessage, IDatastoreMessageOptions, IMessageBusService, IDataMessage } from '@process-engine-js/messagebus_contracts';
import { IRoutingService } from '@process-engine-js/routing_contracts';

import * as moment from 'moment';
import * as debug from 'debug';

const debugInfo = debug('processengine:info');
const debugErr = debug('processengine:error');

interface ICache<T> {
  [key: string]: T;
};

export class ProcessDefEntity extends Entity implements IProcessDefEntity {

  private _messageBusService: IMessageBusService = undefined;
  private _eventAggregator: IEventAggregator = undefined;
  private _timingService: ITimingService = undefined;
  private _processDefEntityTypeService: IProcessDefEntityTypeService = undefined;
  private _processRepository: IProcessRepository = undefined;
  private _featureService: IFeatureService = undefined;
  private _routingService: IRoutingService = undefined
  ;
  constructor(processDefEntityTypeService: IProcessDefEntityTypeService,
              processRepository: IProcessRepository,
              featureService: IFeatureService,
              messageBusService: IMessageBusService,
              routingService: IRoutingService,
              eventAggregator: IEventAggregator,
              timingService: ITimingService,
              entityDependencyHelper: EntityDependencyHelper,
              context: ExecutionContext,
              schema: IInheritedSchema) {
    super(entityDependencyHelper, context, schema);

    this._processDefEntityTypeService = processDefEntityTypeService;
    this._processRepository = processRepository;
    this._featureService = featureService;
    this._messageBusService = messageBusService;
    this._routingService = routingService;
    this._eventAggregator = eventAggregator;
    this._timingService = timingService;
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get timingService(): ITimingService {
    return this._timingService;
  }

  private get processDefEntityTypeService(): IProcessDefEntityTypeService {
    return this._processDefEntityTypeService;
  }

  private get processRepository(): IProcessRepository {
    return this._processRepository;
  }

  private get featureService(): IFeatureService {
    return this._featureService;
  }

  private get messageBusService(): IMessageBusService {
    return this._messageBusService;
  }

  private get routingService(): IRoutingService {
    return this._routingService;
  }

  @schemaAttribute({
    type: SchemaAttributeType.string
  })
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
  public get defId(): string {
    return this.getProperty(this, 'defId');
  }

  public set defId(value: string) {
    this.setProperty(this, 'defId', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get xml(): string {
    return this.getProperty(this, 'xml');
  }

  public set xml(value: string) {
    this.setProperty(this, 'xml', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.object })
  public get extensions(): any {
    return this.getProperty(this, 'extensions');
  }

  public set extensions(value: any) {
    this.setProperty(this, 'extensions', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get internalName(): string {
    return this.getProperty(this, 'internalName');
  }

  public set internalName(value: string) {
    this.setProperty(this, 'internalName', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get path(): string {
    return this.getProperty(this, 'path');
  }

  public set path(value: string) {
    this.setProperty(this, 'path', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get category(): string {
    return this.getProperty(this, 'category');
  }

  public set category(value: string) {
    this.setProperty(this, 'category', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get module(): string {
    return this.getProperty(this, 'module');
  }

  public set module(value: string) {
    this.setProperty(this, 'module', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.boolean })
  public get readonly(): boolean {
    return this.getProperty(this, 'readonly');
  }

  public set readonly(value: boolean) {
    this.setProperty(this, 'readonly', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get version(): string {
    return this.getProperty(this, 'version');
  }

  public set version(value: string) {
    this.setProperty(this, 'version', value);
  }

  @schemaAttribute({ type: SchemaAttributeType.number })
  public get counter(): number {
    return this.getProperty(this, 'counter');
  }

  public set counter(value: number) {
    this.setProperty(this, 'counter', value);
  }

  @schemaAttribute({ type: 'NodeDef', isList: true, relatedAttribute: 'processDef' })
  public get nodeDefCollection(): EntityCollection {
    return this.getProperty(this, 'nodeDefCollection');
  }

  public getNodeDefCollection(context: ExecutionContext): Promise<EntityCollection> {
    return this.getPropertyLazy(this, 'nodeDefCollection', context);
  }

  @schemaAttribute({ type: 'FlowDef', isList: true, relatedAttribute: 'processDef' })
  public get flowDefCollection(): EntityCollection {
    return this.getProperty(this, 'flowDefCollection');
  }

  public getFlowDefCollection(context: ExecutionContext): Promise<EntityCollection> {
    return this.getPropertyLazy(this, 'flowDefCollection', context);
  }

  @schemaAttribute({ type: 'Lane', isList: true, relatedAttribute: 'processDef' })
  public get laneCollection(): EntityCollection {
    return this.getProperty(this, 'laneCollection');
  }

  public getLaneCollection(context: ExecutionContext): Promise<EntityCollection> {
    return this.getPropertyLazy(this, 'laneCollection', context);
  }

  public get features(): Array<IFeature> {
    return this._extractFeatures();
  }

  public async start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<IEntityReference> {

    const processData = {
      key: this.key,
      processDef: this
    };

    const features = this.features;

    if (features === undefined || features.length === 0 || this.featureService.hasFeatures(features)) {
      debugInfo(`start process in same thread (key ${this.key}, features: ${JSON.stringify(features)})`);

      const processEntityType = await this.datastoreService.getEntityType('Process');
      const processEntity: IProcessEntity = (await processEntityType.createEntity(context, processData)) as IProcessEntity;

      await this.invoker.invoke(processEntity, 'start', undefined, context, context, params, options);
      const ref = processEntity.getEntityReference();
      return ref;

    } else {
      const appInstances = this.featureService.getApplicationIdsByFeatures(features);

      if (appInstances.length === 0) {
        debugErr(`can not start process key '${this.key}', features: ${JSON.stringify(features)}, no matching instance found`);
        throw new Error('can not start, no matching instance found');
      }

      const appInstanceId = appInstances[0];

      debugInfo(`start process on application '${appInstanceId}' (key '${this.key}', features: ${JSON.stringify(features)})`);

      // Todo: set correct message format
      const messageOptions: IDatastoreMessageOptions = {
        action: 'POST',
        typeName: 'ProcessDef',
        method: 'start'
      };

      const message: IDatastoreMessage = this.messageBusService.createDatastoreMessage(messageOptions, context, params);
      try {
        const response: IDataMessage = <IDataMessage>(await this.routingService.request(appInstanceId, message));
        const ref = new EntityReference(response.data.namespace, response.data.namespace, response.data.namespace);
        return ref;
      } catch (err) {
        debugErr(`can not start process on application '${appInstanceId}' (key '${this.key}', features: ${JSON.stringify(features)}), error: ${err.message}`);
      }
    }

  }

  public async updateBpmn(context: ExecutionContext, params?: any): Promise<any> {
    const xml = params && params.xml ? params.xml : null;
    if (xml) {
      this.xml = xml;
      this.counter = this.counter + 1;
      await this.updateDefinitions(context);

      if (this.internalName && this.path && !this.readonly) {
        await this.processRepository.saveProcess(this.internalName, this.xml);
      }
      return { result: true };
    }
  }

  private _parseTimerDefinitionType(eventDefinition: any): TimerDefinitionType {
    if (eventDefinition.timeDuration) {
      return TimerDefinitionType.duration;
    }
    if (eventDefinition.timeCycle) {
      return TimerDefinitionType.cycle;
    }
    if (eventDefinition.timeDate) {
      return TimerDefinitionType.date;
    }
    return undefined;
  }

  private _parseTimerDefinition(eventDefinition: any): string {
    if (eventDefinition.timeDuration) {
      return eventDefinition.timeDuration.body;
    }
    if (eventDefinition.timeCycle) {
      return eventDefinition.timeCycle.body;
    }
    if (eventDefinition.timeDate) {
      return eventDefinition.timeDate.body;
    }
    return undefined;
  }

  public async startTimer(context: ExecutionContext): Promise<void> {

    const features = this.features;

    // only start timer if features of process match
    if (features === undefined || features.length === 0 || this.featureService.hasFeatures(features)) {

      // get start event
      const queryObject = {
        operator: 'and',
        queries: [
          { attribute: 'type', operator: '=', value: 'bpmn:StartEvent' },
          { attribute: 'processDef', operator: '=', value: this.id }
        ]
      };
      const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
      const startEventDef: any = await nodeDefEntityType.findOne(context, { query: queryObject });

      if (startEventDef) {

        const channelName = `events/timer/${this.id}`;

        const callback = async () => {
          await this.start(context, undefined);
        };

        switch (startEventDef.timerDefinitionType) {
          case TimerDefinitionType.cycle:
            await this.timingService.periodic(<ITimingRule>startEventDef.timerDefinition, channelName, context);
            this.eventAggregator.subscribe(channelName, callback.bind(this));
            break;
          case TimerDefinitionType.date:
            await this.timingService.once(<moment.Moment>startEventDef.timerDefinition, channelName, context);
            this.eventAggregator.subscribeOnce(channelName, callback.bind(this));
            break;
          case TimerDefinitionType.duration:
            await this.timingService.once(<moment.Moment>startEventDef.timerDefinition, channelName, context);
            this.eventAggregator.subscribeOnce(channelName, callback.bind(this));
            break;
          default: return;
        }
      }
    }
  }

  public async updateDefinitions(context: ExecutionContext, params?: IParamUpdateDefs): Promise<void> {

    let bpmnDiagram = params && params.bpmnDiagram ? params.bpmnDiagram : null;

    const xml = this.xml;
    const key = this.key;
    const counter = this.counter;

    const helperObject = {
      hasTimerStartEvent: false
    };

    if (!bpmnDiagram) {
      bpmnDiagram = await this.processDefEntityTypeService.parseBpmnXml(xml);
    }

    const processes = bpmnDiagram.getProcesses();
    const currentProcess = processes.find((item) => item.id === key);

    if (currentProcess.extensionElements) {
      const extensions = this._updateExtensionElements(currentProcess.extensionElements.values, this);
      this.extensions = extensions;
    }

    this.version = currentProcess.$attrs ? currentProcess.$attrs['camunda:versionTag'] : '';

    await this.save(context, { reloadAfterSave: false });

    // await this.startTimers(processes, context);

    const lanes = bpmnDiagram.getLanes(key);

    const laneCache = await this._updateLanes(lanes, context, counter);

    const nodes = bpmnDiagram.getNodes(key);

    const nodeCache = await this._updateNodes(nodes, laneCache, bpmnDiagram, context, counter, helperObject);

    await this._createBoundaries(nodes, nodeCache, context);

    const flows = bpmnDiagram.getFlows(key);

    await this._updateFlows(flows, nodeCache, context, counter);

    // remove orphaned flows
    const flowDefEntityType = await this.datastoreService.getEntityType('FlowDef');
    const queryObjectFlows: ICombinedQueryClause = {
      operator: 'and',
      queries: [
        { attribute: 'counter', operator: '<', value: counter },
        { attribute: 'processDef', operator: '=', value: this.id }
      ]
    };
    const flowColl = await flowDefEntityType.query(context, { query: queryObjectFlows });
    await flowColl.each(context, async (flowEnt) => {
      await flowEnt.remove(context);
    });

    // remove orphaned nodes
    const nodeDefEntityType = await this.datastoreService.getEntityType('NodeDef');
    const queryObjectNodes: ICombinedQueryClause = {
      operator: 'and',
      queries: [
        { attribute: 'counter', operator: '<', value: counter },
        { attribute: 'processDef', operator: '=', value: this.id }
      ]
    };
    const nodeColl = await nodeDefEntityType.query(context, { query: queryObjectNodes });
    await nodeColl.each(context, async (nodeEnt) => {
      await nodeEnt.remove(context);
    });

    // remove orphaned lanes
    const laneEntityType = await this.datastoreService.getEntityType('Lane');
    const queryObjectLanes: ICombinedQueryClause = {
      operator: 'and',
      queries: [
        { attribute: 'counter', operator: '<', value: counter },
        { attribute: 'processDef', operator: '=', value: this.id }
      ]
    };
    const laneColl = await laneEntityType.query(context, { query: queryObjectLanes });
    await laneColl.each(context, async (laneEnt) => {
      await laneEnt.remove(context);
    });

    if (helperObject.hasTimerStartEvent) {
      await this.startTimer(context);
    }
  }

  private async _updateLanes(lanes: Array<any>, context: ExecutionContext, counter: number): Promise<ICache<any>> {

    const laneCache = {};

    const lane = await this.datastoreService.getEntityType('Lane');

    const lanePromiseArray = lanes.map(async (laneObj) => {

      const queryObject: IQueryObject = {
        operator: 'and',
        queries: [
        { attribute: 'key', operator: '=', value: laneObj.id },
        { attribute: 'processDef', operator: '=', value: this.id }
      ]};

      const queryOptions: IPrivateQueryOptions = {
        query: queryObject
      };

      let laneEntity: any = await lane.findOne(context, queryOptions);

      if (!laneEntity) {
        laneEntity = await lane.createEntity(context);
      }

      laneEntity.key = laneObj.id;
      laneEntity.name = laneObj.name;
      laneEntity.processDef = this;
      laneEntity.counter = counter;

      if (laneObj.extensionElements) {
        const extensions = this._updateExtensionElements(laneObj.extensionElements.values, laneEntity);
        laneEntity.extensions = extensions;
      }

      await laneEntity.save(context, { reloadAfterSave: false });

      laneCache[laneObj.id] = laneEntity;
    });

    await Promise.all(lanePromiseArray);

    return laneCache;
  }

  private async _updateNodes(nodes: Array<any>, laneCache: ICache<any>, bpmnDiagram: BpmnDiagram, context: ExecutionContext,
                             counter: number, helperObject: any): Promise<ICache<any>> {

    const nodeCache = {};

    const nodeDef = await this.datastoreService.getEntityType('NodeDef');

    const nodePromiseArray = nodes.map(async (node) => {

      const queryObject: IQueryObject = {
        operator: 'and',
        queries: [
        { attribute: 'key', operator: '=', value: node.id },
        { attribute: 'processDef', operator: '=', value: this.id }
      ]};

      let nodeDefEntity: any = await nodeDef.findOne(context, { query: queryObject });

      if (!nodeDefEntity) {

        const nodeDefData = {
          key: node.id
        };

        nodeDefEntity = await nodeDef.createEntity(context, nodeDefData);
      }

      switch (node.$type) {
        case 'bpmn:ScriptTask':
          nodeDefEntity.script = node.script || null;
          break;

        case 'bpmn:CallActivity':
          if (node.calledElement) {
            nodeDefEntity.subProcessKey = node.calledElement;
          }
          break;

        case 'bpmn:SubProcess':

          // const subElements = node.flowElements ? node.flowElements : [];

          // const subNodes = subElements.filter((element) => element.$type !== 'bpmn:SequenceFlow');
          // const subFlows = subElements.filter((element) => element.$type === 'bpmn:SequenceFlow');

          break;

        default:
      }

      const eventType = (node.eventDefinitions && node.eventDefinitions.length > 0) ? node.eventDefinitions[0].$type : null;
      if (eventType) {
        nodeDefEntity.eventType = eventType;
        nodeDefEntity.cancelActivity = node.cancelActivity || true;

        if (eventType === 'bpmn:TimerEventDefinition') {
          nodeDefEntity.timerDefinitionType = this._parseTimerDefinitionType(node.eventDefinitions[0]);
          nodeDefEntity.timerDefinition = this._parseTimerDefinition(node.eventDefinitions[0]);

          if (node.$type === 'bpmn:StartEvent') {

            helperObject.hasTimerStartEvent = true;
          }
        }

        if (eventType === 'bpmn:SignalEventDefinition') {
          const signalId = node.eventDefinitions[0].signalRef ? node.eventDefinitions[0].signalRef.id : undefined;
          const signal = bpmnDiagram.getSignalById(signalId);
          nodeDefEntity.signal = signal.name;
        }

        if (eventType === 'bpmn:MessageEventDefinition') {
          const messageId = node.eventDefinitions[0].messageRef ? node.eventDefinitions[0].messageRef.id : undefined;
          const message = bpmnDiagram.getMessageById(messageId);
          nodeDefEntity.message = message.name;
        }

        if (eventType === 'bpmn:ConditionalEventDefinition') {
          const condition = node.eventDefinitions[0].condition ? node.eventDefinitions[0].condition.body : null;
          nodeDefEntity.condition = condition;
        }

      }

      if (node.extensionElements) {

        const extensions = this._updateExtensionElements(node.extensionElements.values, nodeDefEntity);

        nodeDefEntity.extensions = extensions;
      }

      nodeDefEntity.name = node.name;
      nodeDefEntity.type = node.$type;
      nodeDefEntity.events = null;
      nodeDefEntity.processDef = this;
      nodeDefEntity.counter = counter;

      const laneId = bpmnDiagram.getLaneOfElement(node.id);

      if (laneId) {
        nodeDefEntity.lane = laneCache[laneId];
      }

      await nodeDefEntity.save(context, { reloadAfterSave: false });

      nodeCache[node.id] = nodeDefEntity;
    });

    await Promise.all(nodePromiseArray);

    return nodeCache;
  }

  private async _updateFlows(flows: Array<any>, nodeCache: ICache<any>, context: ExecutionContext, counter: number): Promise<void> {

    const flowDef = await this.datastoreService.getEntityType('FlowDef');

    const flowPromiseArray = flows.map(async (flow) => {

      const queryObject: IQueryObject = {
        operator: 'and',
        queries: [
        { attribute: 'key', operator: '=', value: flow.id },
        { attribute: 'processDef', operator: '=', value: this.id }
      ]};

      let flowDefEntity: any = await flowDef.findOne(context, { query: queryObject });

      if (!flowDefEntity) {

        const flowDefData = {
          key: flow.id
        };

        flowDefEntity = await flowDef.createEntity(context, flowDefData);
      }

      flowDefEntity.name = flow.name;
      flowDefEntity.processDef = this;
      flowDefEntity.counter = counter;

      if (flow.sourceRef && flow.sourceRef.id) {
        const sourceId = flow.sourceRef.id;
        flowDefEntity.source = nodeCache[sourceId];
      }

      if (flow.targetRef && flow.targetRef.id) {
        const targetId = flow.targetRef.id;
        flowDefEntity.target = nodeCache[targetId];
      }

      if (flow.conditionExpression && flow.conditionExpression.body) {
        flowDefEntity.condition = flow.conditionExpression.body;
      }

      if (flow.extensionElements) {

        const extensions = this._updateExtensionElements(flow.extensionElements.values, flowDefEntity);

        flowDefEntity.extensions = extensions;
      }

      await flowDefEntity.save(context, { reloadAfterSave: false });
    });

    await Promise.all(flowPromiseArray);
  }

  private async _createBoundaries(nodes: Array<any>, nodeCache: ICache<any>, context: ExecutionContext): Promise<void> {

    const nodePromiseArray = nodes.map(async (node) => {

      if (node.$type === 'bpmn:BoundaryEvent') {
        const attachedKey = (node.attachedToRef && node.attachedToRef.id) ? node.attachedToRef.id : null;
        if (attachedKey) {
          const sourceEnt = nodeCache[attachedKey];
          const boundary = nodeCache[node.id];
          boundary.attachedToNode = sourceEnt;
          await boundary.save(context, { reloadAfterSave: false });

          let events = sourceEnt.events || [];
          if (!Array.isArray(events)) {
            events = [];
          }

          switch (boundary.eventType) {
            case 'bpmn:ErrorEventDefinition':
              events.push({
                type: 'error',
                boundary: boundary.id
              });
              break;

            case 'bpmn:TimerEventDefinition':
              events.push({
                type: 'timer',
                boundary: boundary.id
              });
              break;

            case 'bpmn:SignalEventDefinition':
              events.push({
                type: 'signal',
                boundary: boundary.id
              });
              break;

            case 'bpmn:MessageEventDefinition':
              events.push({
                type: 'message',
                boundary: boundary.id
              });
              break;

            case 'bpmn:CancelEventDefinition':
              events.push({
                type: 'cancel',
                boundary: boundary.id
              });
              break;

            case 'bpmn:ConditionalEventDefinition':
              events.push({
                type: 'condition',
                boundary: boundary.id
              });
              break;

            default:
          }
          sourceEnt.events = events;
          await sourceEnt.save(context, { reloadAfterSave: false });
        }
      }
    });

    await Promise.all(nodePromiseArray);
  }

  private _updateExtensionElements(extensionElements: Array<any>, entity: any): any {

    const ext: any = {};

    extensionElements.forEach((extensionElement) => {

      if (extensionElement.$type === 'camunda:formData') {

        const formFields: Array<any> = [];

        if (extensionElement.$children) {
          extensionElement.$children.forEach((child) => {

            const formValues: Array<any> = [];
            const formProperties: Array<any> = [];

            if (child.$children) {
              child.$children.forEach((formValue) => {

                const childType = formValue.$type;

                switch (childType) {
                  case 'camunda:properties':
                    if (formValue.$children) {
                      formValue.$children.forEach((propChild) => {
                        const newChild = {
                          $type: propChild.$type,
                          name: propChild.id,
                          value: propChild.value
                        };

                        formProperties.push(newChild);
                      });
                    }

                    break;

                  case 'camunda:value':
                    const newFormValue = {
                      $type: formValue.$type,
                      id: formValue.id,
                      name: formValue.name
                    };
                    formValues.push(newFormValue);
                    break;

                  default:

                    break;
                }
              });
            }

            const newChild = {
              $type: child.$type,
              id: child.id,
              label: child.label,
              type: child.type,
              defaultValue: child.defaultValue,
              formValues: formValues,
              formProperties: formProperties
            };

            formFields.push(newChild);
          });
        }

        ext.formFields = formFields;

      } else if (extensionElement.$type === 'camunda:properties') {

        const properties: Array<any> = [];
        if (extensionElement.$children) {
          extensionElement.$children.forEach((child) => {

            const newChild = {
              $type: child.$type,
              name: child.name,
              value: child.value
            };

            switch (child.name) {
              case 'startContext':
                entity.startContext = child.value;
                break;

              case 'startContextEntityType':
                entity.startContextEntityType = child.value;
                break;

              default:

            }

            properties.push(newChild);
          });
        }

        ext.properties = properties;
      }
    });

    return ext;
  }

  private _extractFeatures(): Array<IFeature> {
    let features = undefined;
    const extensions = this.extensions || null;
    const props = (extensions && extensions.properties) ? extensions.properties : null;

    if (props) {
      props.forEach((prop) => {
        if (prop.name === 'features') {
          features = JSON.parse(prop.value);
        }
      });
    }
    return features;
  }

  public async save(context: ExecutionContext, options?: IPrivateSaveOptions): Promise<IEntity> {
    if (this.isNew) {
      if (!this.defId) {
        this.defId = 'Definition_1';
      }
      this.counter = 0;
      if (!this.xml) {
        this.xml = '<?xml version="1.0" encoding="UTF-8"?>' +
          '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" ' +
           'xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="' + this.defId + '" ' +
           'targetNamespace="http://bpmn.io/schema/bpmn" exporter="Camunda Modeler" exporterVersion="1.8.0">' +
          '<bpmn:collaboration id="Collaboration_1cidyxu">' +
          '<bpmn:participant id="Participant_0px403d" name="' + this.name + '" processRef="' + this.key + '" />' +
          '</bpmn:collaboration>' +
          '<bpmn:process id="' + this.key + '" name="' + this.name + '" isExecutable="false">' +
          '<bpmn:laneSet>' +
          '<bpmn:lane id="Lane_1xzf0d3" name="Lane">' +
          '<bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>' +
          '</bpmn:lane>' +
          '</bpmn:laneSet>' +
          '<bpmn:startEvent id="StartEvent_1" name="' + this.name + '" />' +
          '</bpmn:process>' +
          '<bpmndi:BPMNDiagram id="BPMNDiagram_1">' +
          '<bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1cidyxu">' +
          '<bpmndi:BPMNShape id="Participant_0px403d_di" bpmnElement="Participant_0px403d">' +
          '<dc:Bounds x="5" y="4" width="581" height="170" />' +
          '</bpmndi:BPMNShape>' +
          '<bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">' +
          '<dc:Bounds x="101" y="65" width="36" height="36" />' +
          '<bpmndi:BPMNLabel>' +
          '<dc:Bounds x="109" y="101" width="21" height="13" />' +
          '</bpmndi:BPMNLabel>' +
          '</bpmndi:BPMNShape>' +
          '<bpmndi:BPMNShape id="Lane_1xzf0d3_di" bpmnElement="Lane_1xzf0d3">' +
          '<dc:Bounds x="35" y="4" width="551" height="170" />' +
          '</bpmndi:BPMNShape>' +
          '</bpmndi:BPMNPlane>' +
          '</bpmndi:BPMNDiagram>' +
          '</bpmn:definitions>';
      }
    }
    const savedEntity = await this.entityType.save(this, context, options);
    return savedEntity;
  }

  public get persist(): boolean {
    const extensions = this.extensions;
    const properties = (extensions && extensions.properties) ? extensions.properties : null;

    // persisting processes is default
    let found: boolean = true;

    if (properties) {
      properties.some((property) => {
        if (property.name === 'persist') {
          found = (property.value === 'true' || property.value === '1');
          return true;
        }
      });
    }

    return found;
  }
}
