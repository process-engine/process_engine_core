import {
  BpmnTags,
  Definitions,
  IModelParser,
  Model,
} from '@process-engine/process_engine_contracts';

import * as BluebirdPromise from 'bluebird';
import {inspect} from 'util'; // For testing purposes; Remove after implementation is finished
import * as xml2js from 'xml2js';

export class BpmnModelParser implements IModelParser {

  public config: any;

  private _xmlParser: xml2js.Parser = undefined;
  private _xmlParserFunc: Function = undefined;

  private xmlParserOptions: any = {
    explicitArray: false,
    mergeAttrs: true,
  };

  public async initialize(): Promise<void> {

    this._xmlParser = new xml2js.Parser(this.xmlParserOptions);
    this._xmlParserFunc = BluebirdPromise.promisify(this._xmlParser.parseString, {
      context: this._xmlParser,
    });
  }

  public async parseXmlToObjectModel(xml: string): Promise<Definitions> {

    const definitions: any = await this._xmlParserFunc(xml);

    // ----For testing purposes; Remove after implementation is finished
    // tslint:disable:no-console
    const inspectOptions: any = {
      showHidden: false,
      depth: 9,
      maxArrayLength: 100,
    };
    console.log('-----------------------------------------------------------');
    console.log(inspect(definitions[BpmnTags.CommonElement.Definitions], inspectOptions));
    console.log('-----------------------------------------------------------');
    // ----

    return this._convertToInternalObjectModel(definitions[BpmnTags.CommonElement.Definitions]);
  }

  private _convertToInternalObjectModel(parsedXml: any): Definitions {

    const definition: Definitions = this._createDefinitionBaseObject(parsedXml);

    definition.collaboration = this._getCollaboration(parsedXml);
    definition.processes = this._getProcesses(parsedXml);

    return definition;
  }

  private _createDefinitionBaseObject(parsedXml: any): Definitions {

    const basicDefinition: Definitions = new Definitions();

    basicDefinition.id = parsedXml.id;
    basicDefinition.xmlns = {
      bpmn: parsedXml[BpmnTags.XmlnsProperty.bpmn],
      bpmndi: parsedXml[BpmnTags.XmlnsProperty.bpmndi],
      camunda: parsedXml[BpmnTags.XmlnsProperty.camunda],
      dc: parsedXml[BpmnTags.XmlnsProperty.dc],
      di: parsedXml[BpmnTags.XmlnsProperty.di],
      xsi: parsedXml[BpmnTags.XmlnsProperty.xsi],
    };

    basicDefinition.targetNamespace = parsedXml.targetNamespace;
    basicDefinition.exporter = parsedXml.exporter;
    basicDefinition.exporterVersion = parsedXml.exporterVersion;

    return basicDefinition;
  }

  private _getCollaboration(data: any): Model.Types.Collaboration {

    const collaborationData: any = data[BpmnTags.CommonElement.Collaboration];

    const collaboration: Model.Types.Collaboration = this._createObjectWithBaseProperties<Model.Types.Collaboration>(data);

    collaboration.participants = this._getCollaborationParticipants(collaborationData);

    return collaboration;
  }

  private _getCollaborationParticipants(collaborationData: any): Array<Model.Types.Participant> {

    // NOTE: Depending on how the 'bpmn:participant' tag has been formatted and the number of stored participants,
    // this can be either an Array or an Object. For easy usability, we'll always convert this to an Array, since this
    // is what our object model expects.
    const participantData: Array<any> = this._getModelPropertyAsArray(collaborationData, BpmnTags.CommonElement.Participant);

    const convertedParticipants: Array<Model.Types.Participant> = [];

    participantData.forEach((participantRaw: any): void => {
        const participant: Model.Types.Participant = this._createObjectWithBaseProperties<Model.Types.Participant>(participantRaw);

        participant.name = participantRaw.name;
        participant.processReference = participantRaw.processRef;

        convertedParticipants.push(participant);
    });

    return convertedParticipants;
  }

  private _getProcesses(data: any): Array<Model.Types.Process> {

    // NOTE: See above, this can be an Object or an Array.
    const processData: Array<any> = this._getModelPropertyAsArray(data, BpmnTags.CommonElement.Process);

    const processes: Array<Model.Types.Process> = [];

    processData.forEach((processRaw: any): void => {

      const process: Model.Types.Process = this._createObjectWithBaseProperties<Model.Types.Process>(processRaw);

      process.name = processRaw.name;
      process.isExecutable = processRaw.isExecutable === 'true' ? true : false;

      process.laneSet = this._getProcessLaneSet(processRaw);
      process.sequenceFlows = this._getProcessFlowSequences(processRaw);
      process.flowNodes = this._getProcessFlowNodes(processRaw);

      processes.push(process);
    });

    return processes;
  }

  private _getProcessLaneSet(data: any): Model.Types.LaneSet {

    const laneSetData: any = data[BpmnTags.Lane.LaneSet] || data[BpmnTags.LaneProperty.ChildLaneSet];

    if (!laneSetData) {
      return undefined;
    }

    // NOTE: See above, this can be an Object or an Array.
    const lanesRaw: Array<any> = this._getModelPropertyAsArray(laneSetData, BpmnTags.Lane.Lane);

    const laneSet: Model.Types.LaneSet = new Model.Types.LaneSet();

    if (!lanesRaw) {
      return laneSet;
    }

    lanesRaw.forEach((laneRaw: any): void => {
      const lane: Model.Types.Lane = this._createObjectWithBaseProperties<Model.Types.Lane>(laneRaw);

      lane.name = laneRaw.name;
      lane.flowNodeReferences = laneRaw[BpmnTags.LaneProperty.FlowNodeRef];

      if (laneRaw[BpmnTags.LaneProperty.ChildLaneSet]) {
        lane.childLaneSet = this._getProcessLaneSet(laneRaw);
      }

      laneSet.lanes.push(lane);
    });

    return laneSet;
  }

  private _getProcessFlowSequences(data: any): Array<Model.Types.SequenceFlow> {

    // NOTE: See above, this can be an Object or an Array (Admittedly, the first is somewhat unlikely here, but not impossible).
    const sequenceData: Array<any> = this._getModelPropertyAsArray(data, BpmnTags.CommonElement.SequenceFlow);

    const sequences: Array<Model.Types.SequenceFlow> = [];

    sequenceData.forEach((sequenceRaw: any): void => {

      const sequenceFlow: Model.Types.SequenceFlow = this._createObjectWithBaseProperties<Model.Types.SequenceFlow>(sequenceRaw);

      sequenceFlow.name = sequenceRaw.name;
      sequenceFlow.sourceRef = sequenceRaw.sourceRef;
      sequenceFlow.targetRef = sequenceRaw.targetRef;

      if (data[BpmnTags.FlowElementProperty.ConditionExpression]) {
        const conditionData: any = data[BpmnTags.FlowElementProperty.ConditionExpression];

        sequenceFlow.conditionExpression = {
          type: conditionData[BpmnTags.FlowElementProperty.XsiType],
          expression: conditionData._,
        };
      }

      sequences.push(sequenceFlow);
    });

    return sequences;
  }

  // TODO
  private _getProcessFlowNodes(processData: any): Array<Model.Base.FlowNode> {

    let nodes: Array<Model.Base.FlowNode> = [];

    const gateways: Array<Model.Gateways.Gateway> = this._getGateways(processData);
    const tasks: Array<Model.Activities.Activity> = this._getActivities(processData);
    const events: Array<Model.Events.Event> = this._getEvents(processData);

    nodes = nodes.concat(gateways, tasks, events);

    return nodes;
  }

  private _getGateways(processData: any): Array<Model.Gateways.Gateway> {

    const exclusiveGateways: Array<Model.Gateways.ExclusiveGateway> =
      this._parseGatewaysByType<Model.Gateways.ExclusiveGateway>(processData, BpmnTags.GatewayElement.ExclusiveGateway);

    const parallelGateways: Array<Model.Gateways.ParallelGateway> =
      this._parseGatewaysByType<Model.Gateways.ParallelGateway>(processData, BpmnTags.GatewayElement.ParallelGateway);

    const inclusiveGateways: Array<Model.Gateways.InclusiveGateway> =
      this._parseGatewaysByType<Model.Gateways.InclusiveGateway>(processData, BpmnTags.GatewayElement.InclusiveGateway);

    const complexGateways: Array<Model.Gateways.ComplexGateway> =
      this._parseGatewaysByType<Model.Gateways.ComplexGateway>(processData, BpmnTags.GatewayElement.ComplexGateway);

    return Array.prototype.concat(parallelGateways, exclusiveGateways, inclusiveGateways, complexGateways);
  }

  // NOTE: We can use one converter method for all Gateway types, because they all use the exact same properties.
  // Unfortunately, however, this does not work for activities and events.
  private _parseGatewaysByType<TGateway extends Model.Gateways.Gateway>(
    processData: Array<any>,
    gatewayType: BpmnTags.GatewayElement,
  ): Array<TGateway> {

    const gateways: Array<TGateway> = [];

    const gatewaysRaw: Array<TGateway> = this._getModelPropertyAsArray(processData, gatewayType);

    if (!gatewaysRaw || gatewaysRaw.length === 0) {
      return [];
    }

    gatewaysRaw.forEach((gatewayRaw: any): void => {
      const gateway: TGateway = this._createObjectWithBaseProperties<TGateway>(gatewayRaw);
      gateway.incoming = this._getModelPropertyAsArray(gatewayRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
      gateway.outgoing = this._getModelPropertyAsArray(gatewayRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);
      gateways.push(gateway);
    });

    return gateways;
  }

  private _getActivities(processData: any): Array<Model.Activities.Activity> {
    return new Array<Model.Activities.Activity>();
  }

  private _getEvents(processData: any): Array<Model.Events.Event> {
    return new Array<Model.Events.Event>();
  }

  private _getModelPropertyAsArray(model: any, elementName: string): any {

    if (!model[elementName]) {
      return undefined;
    }

    return Array.isArray(model[elementName]) ? model[elementName] : [model[elementName]];
  }

  private _createObjectWithBaseProperties<T extends Model.Base.BaseElement>(data: any): T {

    const obj: Model.Base.BaseElement = {
      id: data.id,
    };

    if (data[BpmnTags.FlowElementProperty.Documentation]) {
      obj.documentation = [data[BpmnTags.FlowElementProperty.Documentation]];
    }

    if (data[BpmnTags.FlowElementProperty.ExtensionElements]) {

      const extensionData: any = data[BpmnTags.FlowElementProperty.ExtensionElements];

      obj.extensionElements = new Model.Base.ExtensionElements();
      obj.extensionElements.camundaExecutionListener = extensionData[BpmnTags.FlowElementProperty.CamundaExecutionListener];

      // NOTE: The extension property collection is wrapped in a property named "camunda:property",
      // which in turn is located in "camunda:properties".
      const propertyCollection: any = extensionData[BpmnTags.FlowElementProperty.CamundaProperties];

      // This covers all properties defined in the Extensions-Panel (mapper, module/method/param, etc).
      obj.extensionElements.camundaExtensionProperties =
        this._getModelPropertyAsArray(propertyCollection, BpmnTags.FlowElementProperty.CamundaProperty);
    }

    return <T> obj;
  }

}
