import {Entity, IEntityType, IPropertyBag, IFactory, IDataModel, ISchemas} from 'data_model_contracts';
import {IInvoker} from 'invocation_contracts';
import {ExecutionContext} from 'iam_contracts';
import {IProcessDefEntityTypeService, BpmnDiagram} from 'process_engine_contracts';

interface ICache<T> {
  [key: string]: T
};

export class ProcessDefEntity extends Entity {

  static attributes: any = {
      name: { type: 'string' },
      key: { type: 'string' },
      defId: { type: 'string' },
      xml: { type: 'string' }
  };

  private _processDefEntityTypeService: IProcessDefEntityTypeService = undefined;
  private _dataModel: IDataModel = undefined;

  constructor(processDefEntityTypeService: IProcessDefEntityTypeService, dataModel: IDataModel, propertyBagFactory: IFactory<IPropertyBag>, invoker: IInvoker, entityType: IEntityType<ProcessDefEntity>, context: ExecutionContext, schemas: ISchemas) {
    super(propertyBagFactory, invoker, entityType, context, schemas);

    this._processDefEntityTypeService = processDefEntityTypeService;
    this._dataModel = dataModel;
  }

  private get processDefEntityTypeService(): IProcessDefEntityTypeService {
    return this._processDefEntityTypeService;
  }
  
  private get dataModel(): IDataModel {
    return this._dataModel;
  }

  public get xml(): any {
    return this.getProperty(this, 'xml');
  }

  public get key(): any {
    return this.getProperty(this, 'key');
  }

  public async start(context: ExecutionContext): Promise<void> {

    const typeName = 'Process';

    const processData = {
      key: this.key,
      processDef: this
    };

    const processEntityType = await this.dataModel.getEntityType(typeName);

    const processEntity = processEntityType.createEntity(context, processData);

    await processEntity.save(context);

    await this.invoker.invoke(processEntity, 'start', context);
  }

  public async updateDefinitions(context: ExecutionContext, newBpmnDiagram?: BpmnDiagram): Promise<void> {

    let bpmnDiagram = newBpmnDiagram;

    if (!bpmnDiagram) {
      bpmnDiagram = await this.processDefEntityTypeService.parseBpmnXml(this.xml);
    }

    const lanes = bpmnDiagram.getLanes(this.key);

    const laneCache = await this._updateLanes(lanes, context);

    const nodes = bpmnDiagram.getNodes(this.key);

    const nodeCache = await this._updateNodes(nodes, laneCache, bpmnDiagram, context);

    const flows = bpmnDiagram.getFlows(this.key);
    
    await this._updateFlows(flows, nodeCache, context);
  }

  private async _updateLanes(lanes: Array<any>, context: ExecutionContext): Promise<ICache<any>> {

    const laneCache = {};
    const typeName = 'Lane';

    const laneEntityType = await this.dataModel.getEntityType(typeName);

    const lanePromiseArray = lanes.map(async (lane) => {

      const queryObject = [
        { attribute: 'key', operator: '=', value: lane.id },
        { attribute: 'processDef.key', operator: '=', value: this.key }
      ];

      let laneEntity: any = await laneEntityType.findOne(context, { query: queryObject });

      if (!laneEntity) {

        const laneData = {
          key: lane.id
        };

        laneEntity = laneEntityType.createEntity(context, laneData);
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
    const typeName = 'NodeDef';

    const nodeDefEntityType = await this.dataModel.getEntityType(typeName);

    const nodePromiseArray = nodes.map(async (node) => {

      const queryObject = [
        { attribute: 'key', operator: '=', value: node.id },
        { attribute: 'processDef.key', operator: '=', value: this.key }
      ];

      let nodeDefEntity: any = await nodeDefEntityType.findOne(context, { query: queryObject });

      if (!nodeDefEntity) {

        const nodeDefData = {
          key: node.id
        };

        nodeDefEntity = nodeDefEntityType.createEntity(context, nodeDefData);
      }
      
      if (node.extensionElements) {

        const extensions = this._updateExtensionElements(node.extensionElements.values);

        nodeDefEntity.extensions = extensions;
      }

      nodeDefEntity.name = node.name;
      nodeDefEntity.type = node['$type'];
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

    const typeName = 'FlowDef';

    const flowDefEntityType = await this.dataModel.getEntityType(typeName);

    const flowPromiseArray = flows.map(async (flow) => {

      const queryObject = [
        { attribute: 'key', operator: '=', value: flow.id },
        { attribute: 'processDef.key', operator: '=', value: this.key }
      ];

      let flowDefEntity: any = await flowDefEntityType.findOne(context, { query: queryObject });

      if (!flowDefEntity) {

        const flowDefData = {
          key: flow.id
        };

        flowDefEntity = flowDefEntityType.createEntity(context, flowDefData);
      }

      flowDefEntity.name = flow.name;
      flowDefEntity.processDef = this;

      const sourceId = flow.sourceRef.id;
      flowDefEntity.source = nodeCache[sourceId];

      const targetId = flow.targetRef.id;
      flowDefEntity.target = nodeCache[targetId];
          
      if (flow.conditionExpression && flow.conditionExpression.body) {
        flowDefEntity.condition = flow.conditionExpression.body;
      }

      await flowDefEntity.save(context);
    });

    await Promise.all(flowPromiseArray);
  }

  private _updateExtensionElements(extensionElements: Array<any>): any {
    
    const ext: any = {};

    extensionElements.forEach((extensionElement) => {

      if (extensionElement['$type'] === 'camunda:formData') {

        const formFields = [];

        extensionElement['$children'].forEach((child) => {

          const formValues = [];
          const formProperties = [];
                  
          child['$children'].forEach((formValue) => {

            const childType = formValue['$type'];

            switch (childType) {
              case 'camunda:properties':
                formValue['$children'].forEach((child) => {
                  const newChild = {
                    ['$type']: child['$type'],
                    name: child.id,
                    value: child.value
                  };
                  
                  formProperties.push(newChild);
                });

                break;

              case 'camunda:value':
                const newFormValue = {
                  ['$type']: formValue['$type'],
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
            ['$type']: child['$type'],
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

      } else if (extensionElement['$type'] === 'camunda:properties') {

        const properties = [];
        extensionElement['$children'].forEach((child) => {

          const newChild = {
            ['$type']: child['$type'],
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