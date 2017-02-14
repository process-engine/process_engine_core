import {ExecutionContext, SchemaAttributeType, IFactory, IInheritedSchema, IEntity} from '@process-engine-js/core_contracts';
import {Entity, IEntityType, IPropertyBag} from '@process-engine-js/data_model_contracts';
import { IDatastoreService } from '@process-engine-js/datastore_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import { IProcessDefEntityTypeService, BpmnDiagram, IProcessDefEntity, IParamUpdateDefs} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';

import * as uuid from 'uuid';

interface ICache<T> {
  [key: string]: T
};

export class ProcessDefEntity extends Entity implements IProcessDefEntity {

  private _processDefEntityTypeService: IProcessDefEntityTypeService = undefined;
  private _datastoreService: IDatastoreService = undefined;

  constructor(processDefEntityTypeService: IProcessDefEntityTypeService, datastoreService: IDatastoreService, propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<IProcessDefEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(propertyBagFactory, invoker, entityType, context, schema);

    this._processDefEntityTypeService = processDefEntityTypeService;
    this._datastoreService = datastoreService;
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  private get processDefEntityTypeService(): IProcessDefEntityTypeService {
    return this._processDefEntityTypeService;
  }
  
  private get datastoreService(): IDatastoreService {
    return this._datastoreService;
  }


  @schemaAttribute({
    type: SchemaAttributeType.string,
    onInit: () => {
      return uuid.v4();
    }
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

  public async start(context: ExecutionContext): Promise<void> {

    const processData = {
      key: this.key,
      processDef: this
    };

    const processEntityType = await this.datastoreService.getEntityType('Process');

    const processEntity = await processEntityType.createEntity(context, processData);

    await processEntity.save(context);

    const saveOptions = {};

    const argumentsPassedToSave: Array<any> = [context, saveOptions];

    await this.invoker.invoke(processEntity, 'start', context, ...argumentsPassedToSave);
  }


  public async updateBpmn(context: ExecutionContext, params?: any): Promise<any> {
    const xml = params && params.xml ? params.xml : null;
    if (xml) {
      this.xml = xml;

      await this.save(context);
      await this.updateDefinitions(context);

      return { result: true };
    }
  }


  public async updateDefinitions(context: ExecutionContext, params?: IParamUpdateDefs): Promise<void> {

    let bpmnDiagram = params && params.bpmnDiagram ? params.bpmnDiagram : null;

    const xml = this.xml;
    const key = this.key;

    if (!bpmnDiagram) {
      bpmnDiagram = await this.processDefEntityTypeService.parseBpmnXml(xml);
    }

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

      const queryObject = [
        { attribute: 'key', operator: '=', value: lane.id },
        { attribute: 'processDef', operator: '=', value: this.id }
      ];

      const queryOptions = {
        query: queryObject
      };

      let laneEntity: any = await Lane.findOne(context, queryOptions);

      if (!laneEntity) {

        const laneData = {
          key: lane.id
        };

        laneEntity = await Lane.createEntity(context, laneData);
      }

      laneEntity.name = lane.name;
      laneEntity.processDef = this;

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

      const queryObject = [
        { attribute: 'key', operator: '=', value: node.id },
        { attribute: 'processDef', operator: '=', value: this.id }
      ];

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

      const queryObject = [
        { attribute: 'key', operator: '=', value: flow.id },
        { attribute: 'processDef', operator: '=', value: this.id }
      ];

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

        extensionElement.$children.forEach((child) => {

          const formValues: Array<any> = [];
          const formProperties: Array<any> = [];
                  
          child.$children.forEach((formValue) => {

            const childType = formValue.$type;

            switch (childType) {
              case 'camunda:properties':
                formValue.$children.forEach((child) => {
                  const newChild = {
                    $type: child.$type,
                    name: child.id,
                    value: child.value
                  };
                  
                  formProperties.push(newChild);
                });

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

        ext.formFields = formFields;

      } else if (extensionElement.$type === 'camunda:properties') {

        const properties: Array<any> = [];
        extensionElement.$children.forEach((child) => {

          const newChild = {
            $type: child.$type,
            name: child.name,
            value: child.value
          };
          
          properties.push(newChild);
        });

        ext.properties = properties;
      }
    });

    return ext;
  }
  
}
