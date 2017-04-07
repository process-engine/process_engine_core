import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema, IQueryObject, IPrivateQueryOptions, IPublicGetOptions} from '@process-engine-js/core_contracts';
import {Entity, EntityDependencyHelper, EntityCollection} from '@process-engine-js/data_model_contracts';
import {TimerDefinitionType, IProcessDefEntityTypeService, BpmnDiagram, IProcessDefEntity, IParamUpdateDefs, IParamStart, IProcessEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {IFeature} from '@process-engine-js/feature_contracts';
import {ITimingService, ITimingRule} from '@process-engine-js/timing_contracts';
import {IMessageBusService} from '@process-engine-js/messagebus_contracts';
import {IEventAggregator} from '@process-engine-js/event_aggregator_contracts';

import * as uuid from 'uuid';
import * as moment from 'moment';

interface ICache<T> {
  [key: string]: T;
};

export class ProcessDefEntity extends Entity implements IProcessDefEntity {

  private _messageBusService: IMessageBusService = undefined;
  private _eventAggregator: IEventAggregator = undefined;
  private _timingService: ITimingService = undefined;
  private _processDefEntityTypeService: IProcessDefEntityTypeService = undefined;

  constructor(messageBusService: IMessageBusService,
              eventAggregator: IEventAggregator,
              timingService: ITimingService,
              processDefEntityTypeService: IProcessDefEntityTypeService,
              entityDependencyHelper: EntityDependencyHelper, 
              context: ExecutionContext,
              schema: IInheritedSchema) {
    super(entityDependencyHelper, context, schema);

    this._messageBusService = messageBusService;
    this._eventAggregator = eventAggregator;
    this._timingService = timingService;
    this._processDefEntityTypeService = processDefEntityTypeService;
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  private get messageBusService(): IMessageBusService {
    return this._messageBusService;
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

  @schemaAttribute({ type: 'NodeDef', isList: true, relatedAttribute: 'processDef' })
  public get nodeDefCollection(): EntityCollection {
    return this.getProperty(this, 'nodeDefCollection');
  }

  public getNodeDefCollection(context: ExecutionContext): Promise<EntityCollection> {
    return this.getPropertyLazy(this, 'nodeDefCollection', context);
  }

  public get features(): Array<IFeature> {
    return this._extractFeatures();
  }

  public async start(context: ExecutionContext, params: IParamStart, options?: IPublicGetOptions): Promise<IProcessEntity> {

    const processData = {
      key: this.key,
      processDef: this
    };

    const processEntityType = await this.datastoreService.getEntityType('Process');

    const processEntity: IProcessEntity = (await processEntityType.createEntity(context, processData)) as IProcessEntity;

    await processEntity.save(context);

    await this.invoker.invoke(processEntity, 'start', undefined, context, context, params, options);

    return processEntity;
  }


  public async updateBpmn(context: ExecutionContext, params?: any): Promise<any> {
    const xml = params && params.xml ? params.xml : null;
    if (xml) {
      this.xml = xml;

      await this.updateDefinitions(context);

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

  private _parseTimerDefinition(eventDefinition: any): moment.Moment | ITimingRule {
    if (eventDefinition.timeDuration) {
      const input = eventDefinition.timeDuration.body;
      const duration = moment.duration(input);
      const date = moment().add(duration);
      return date;
    }
    if (eventDefinition.timeCycle) {
      const input = eventDefinition.timeCycle.body;    
      const duration = moment.duration(input);
      const timingRule = {
        year: duration.years(),
        month: duration.months(),
        date: duration.days(),
        hour: duration.hours(),
        minute: duration.minutes(),
        second: duration.seconds()
      }
      return timingRule;
    }
    if (eventDefinition.timeDate) {
      const input = eventDefinition.timeDate.body;
      const date = moment(input);
      return date;
    }
    return undefined;
  }

  private async startTimers(processes: Array<any>, context: ExecutionContext): Promise<void> {

    const processPromises = processes.map(async (process) => {
      
      const startEvents = process.flowElements.filter((element) => {
        return element.$type === 'bpmn:StartEvent';
      });

      if (startEvents.length === 0) {
        return;
      }

      const eventPromises = startEvents.map(async (startEvent) => {
        
        const definitionPromises = startEvent.eventDefinitions.map(async (eventDefinition) => {

          if (eventDefinition.$type !== 'bpmn:TimerEventDefinition') {
            return;
          }

          const timerDefinitionType = this._parseTimerDefinitionType(eventDefinition);
          const timerDefinition = this._parseTimerDefinition(eventDefinition);
          
          if (timerDefinitionType === undefined || timerDefinition === undefined) {
            return;
          }

          await this._startTimer(timerDefinitionType, timerDefinition, async () => {

            const data = {
              action: 'start',
              key: this.key,
              token: undefined
            }
            
            const message = this.messageBusService.createEntityMessage(data, this, context);
            await this.messageBusService.publish('/processengine', message);

          }, context);

        });
        await Promise.all(definitionPromises);
      });
      await Promise.all(eventPromises);
    });
    await Promise.all(processPromises);
  }

  private async _startTimer(timerDefinitionType: TimerDefinitionType, timerDefinition: moment.Moment | ITimingRule, callback: Function, context: ExecutionContext): Promise<void> {
    
    const channelName = `events/timer/${this.id}`;
    
    switch (timerDefinitionType) {
      case TimerDefinitionType.cycle: 
        await this.timingService.periodic(<ITimingRule>timerDefinition, channelName, context);
        break;
      case TimerDefinitionType.date: 
        await this.timingService.once(<moment.Moment>timerDefinition, channelName, context);
        break;
      case TimerDefinitionType.duration: 
        await this.timingService.once(<moment.Moment>timerDefinition, channelName, context);
        break;
      default: return;
    }

    await this.eventAggregator.subscribeOnce(channelName, callback);
  }

  public async updateDefinitions(context: ExecutionContext, params?: IParamUpdateDefs): Promise<void> {

    let bpmnDiagram = params && params.bpmnDiagram ? params.bpmnDiagram : null;

    const xml = this.xml;
    const key = this.key;

    if (!bpmnDiagram) {
      bpmnDiagram = await this.processDefEntityTypeService.parseBpmnXml(xml);
    }

    const processes = bpmnDiagram.getProcesses();
    const currentProcess = processes.find((item) => item.id === key);

    if (currentProcess.extensionElements) {
      const extensions = this._updateExtensionElements(currentProcess.extensionElements.values);
      this.extensions = extensions;
    }
    await this.save(context);

    await this.startTimers(processes, context);

    const lanes = bpmnDiagram.getLanes(key);

    const laneCache = await this._updateLanes(lanes, context);

    const nodes = bpmnDiagram.getNodes(key);

    const nodeCache = await this._updateNodes(nodes, laneCache, bpmnDiagram, context);

    await this._createBoundaries(nodes, nodeCache, context);

    const flows = bpmnDiagram.getFlows(key);
    
    await this._updateFlows(flows, nodeCache, context);
  }

  private async _updateLanes(lanes: Array<any>, context: ExecutionContext): Promise<ICache<any>> {

    const laneCache = {};

    const Lane = await this.datastoreService.getEntityType('Lane');

    const lanePromiseArray = lanes.map(async (lane) => {

      const queryObject: IQueryObject = {
        operator: 'and',
        queries: [
        { attribute: 'key', operator: '=', value: lane.id },
        { attribute: 'processDef', operator: '=', value: this.id }
      ]};

      const queryOptions: IPrivateQueryOptions = {
        query: queryObject
      };

      let laneEntity: any = await Lane.findOne(context, queryOptions);

      if (!laneEntity) {
        laneEntity = await Lane.createEntity(context);
      }

      laneEntity.key = lane.id;
      laneEntity.name = lane.name;
      laneEntity.processDef = this;

      if (lane.extensionElements) {
        const extensions = this._updateExtensionElements(lane.extensionElements.values);
        laneEntity.extensions = extensions;
      }

      await laneEntity.save(context);
      
      laneCache[lane.id] = laneEntity;
    });

    await Promise.all(lanePromiseArray);

    return laneCache;
  }

  private async _updateNodes(nodes: Array<any>, laneCache: ICache<any>, bpmnDiagram: BpmnDiagram, context: ExecutionContext): Promise<ICache<any>> {

    const nodeCache = {};

    const NodeDef = await this.datastoreService.getEntityType('NodeDef');

    const nodePromiseArray = nodes.map(async (node) => {

      const queryObject: IQueryObject = {
        operator: 'and',
        queries: [
        { attribute: 'key', operator: '=', value: node.id },
        { attribute: 'processDef', operator: '=', value: this.id }
      ]};

      let nodeDefEntity: any = await NodeDef.findOne(context, { query: queryObject });

      if (!nodeDefEntity) {

        const nodeDefData = {
          key: node.id
        };

        nodeDefEntity = await NodeDef.createEntity(context, nodeDefData);
      }
      
      switch (node.$type) {
        case 'bpmn:ScriptTask':
          nodeDefEntity.script = node.script || null;
          break;

        case 'bpmn:BoundaryEvent':
          const eventType = (node.eventDefinitions && node.eventDefinitions.length > 0) ? node.eventDefinitions[0].$type : null;
          if (eventType) {
            nodeDefEntity.eventType = eventType;
            nodeDefEntity.cancelActivity = node.cancelActivity || true;
          }
          break;

        case 'bpmn:CallActivity':
          if (node.calledElement) {
            nodeDefEntity.subProcessKey = node.calledElement;
          }
          break;

        case 'bpmn:SubProcess':

          const subElements = node.flowElements ? node.flowElements : [];

          const subNodes = subElements.filter((element) => element.$type !== 'bpmn:SequenceFlow');
          const subFlows = subElements.filter((element) => element.$type === 'bpmn:SequenceFlow');



          break;

        default:
      }

      if (node.extensionElements) {

        const extensions = this._updateExtensionElements(node.extensionElements.values);

        nodeDefEntity.extensions = extensions;
      }

      nodeDefEntity.name = node.name;
      nodeDefEntity.type = node.$type;
      nodeDefEntity.processDef = this;

      const laneId = bpmnDiagram.getLaneOfElement(node.id);

      if (laneId) {
        nodeDefEntity.lane = laneCache[laneId];
      }

      await nodeDefEntity.save(context);

      nodeCache[node.id] = nodeDefEntity;
    });

    await Promise.all(nodePromiseArray);

    return nodeCache;
  }

  private async _updateFlows(flows: Array<any>, nodeCache: ICache<any>, context: ExecutionContext): Promise<void> {

    const FlowDef = await this.datastoreService.getEntityType('FlowDef');

    const flowPromiseArray = flows.map(async (flow) => {

      const queryObject: IQueryObject = {
        operator: 'and',
        queries: [
        { attribute: 'key', operator: '=', value: flow.id },
        { attribute: 'processDef', operator: '=', value: this.id }
      ]};

      let flowDefEntity: any = await FlowDef.findOne(context, { query: queryObject });

      if (!flowDefEntity) {

        const flowDefData = {
          key: flow.id
        };

        flowDefEntity = await FlowDef.createEntity(context, flowDefData);
      }

      flowDefEntity.name = flow.name;
      flowDefEntity.processDef = this;

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

      await flowDefEntity.save(context);
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
          await boundary.save(context);

          const events = sourceEnt.events || {};
          switch (boundary.eventType) {
            case 'bpmn:ErrorEventDefinition':
              events.error = boundary.key;
              break;

            default:
          }
          sourceEnt.events = events;
          await sourceEnt.save(context);
        }
      }
    });

    await Promise.all(nodePromiseArray);
  }


  private _updateExtensionElements(extensionElements: Array<any>): any {
    
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
                      formValue.$children.forEach((child) => {
                        const newChild = {
                          $type: child.$type,
                          name: child.id,
                          value: child.value
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
}
