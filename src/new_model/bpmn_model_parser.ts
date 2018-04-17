import {
  BpmnTags,
  Definitions,
  IModelParser,
  Model,
} from '@process-engine/process_engine_contracts';

import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
  setCommonObjectPropertiesFromData,
} from './type_factory';

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

    const collaboration: Model.Types.Collaboration = createObjectWithCommonProperties(data, Model.Types.Collaboration);

    collaboration.participants = this._getCollaborationParticipants(collaborationData);

    return collaboration;
  }

  private _getCollaborationParticipants(collaborationData: any): Array<Model.Types.Participant> {

    // NOTE: Depending on how the 'bpmn:participant' tag has been formatted and the number of stored participants,
    // this can be either an Array or an Object. For easy usability, we'll always convert this to an Array, since this
    // is what our object model expects.
    const participantData: Array<any> = getModelPropertyAsArray(collaborationData, BpmnTags.CommonElement.Participant);

    const convertedParticipants: Array<Model.Types.Participant> = [];

    participantData.forEach((participantRaw: any): void => {
        const participant: Model.Types.Participant = createObjectWithCommonProperties(participantRaw, Model.Types.Participant);

        participant.name = participantRaw.name;
        participant.processReference = participantRaw.processRef;

        convertedParticipants.push(participant);
    });

    return convertedParticipants;
  }

  private _getProcesses(data: any): Array<Model.Types.Process> {

    // NOTE: See above, this can be an Object or an Array.
    const processData: Array<any> = getModelPropertyAsArray(data, BpmnTags.CommonElement.Process);

    const processes: Array<Model.Types.Process> = [];

    processData.forEach((processRaw: any): void => {

      const process: Model.Types.Process = createObjectWithCommonProperties(processRaw, Model.Types.Process);

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
    const lanesRaw: Array<any> = getModelPropertyAsArray(laneSetData, BpmnTags.Lane.Lane);

    const laneSet: Model.Types.LaneSet = new Model.Types.LaneSet();

    if (!lanesRaw) {
      return laneSet;
    }

    lanesRaw.forEach((laneRaw: any): void => {
      const lane: Model.Types.Lane = createObjectWithCommonProperties(laneRaw, Model.Types.Lane);

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
    const sequenceData: Array<any> = getModelPropertyAsArray(data, BpmnTags.CommonElement.SequenceFlow);

    const sequences: Array<Model.Types.SequenceFlow> = [];

    sequenceData.forEach((sequenceRaw: any): void => {

      const sequenceFlow: Model.Types.SequenceFlow = createObjectWithCommonProperties(sequenceRaw, Model.Types.SequenceFlow);

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
      this._parseGatewaysByType(processData, BpmnTags.GatewayElement.ExclusiveGateway, Model.Gateways.ExclusiveGateway);

    const parallelGateways: Array<Model.Gateways.ParallelGateway> =
      this._parseGatewaysByType(processData, BpmnTags.GatewayElement.ParallelGateway, Model.Gateways.ParallelGateway);

    const inclusiveGateways: Array<Model.Gateways.InclusiveGateway> =
      this._parseGatewaysByType(processData, BpmnTags.GatewayElement.InclusiveGateway, Model.Gateways.InclusiveGateway);

    const complexGateways: Array<Model.Gateways.ComplexGateway> =
      this._parseGatewaysByType(processData, BpmnTags.GatewayElement.ComplexGateway, Model.Gateways.ComplexGateway);

    return Array.prototype.concat(parallelGateways, exclusiveGateways, inclusiveGateways, complexGateways);
  }

  private _parseGatewaysByType<TGateway extends Model.Gateways.Gateway>(
    processData: Array<any>,
    gatewayType: BpmnTags.GatewayElement,
    type: Model.Base.IConstructor<TGateway>,
  ): Array<TGateway> {

    const gateways: Array<TGateway> = [];

    const gatewaysRaw: Array<TGateway> = getModelPropertyAsArray(processData, gatewayType);

    if (!gatewaysRaw || gatewaysRaw.length === 0) {
      return [];
    }

    gatewaysRaw.forEach((gatewayRaw: any): void => {
      let gateway: TGateway = new type();
      gateway = <TGateway> setCommonObjectPropertiesFromData(gatewayRaw, gateway);
      gateway.name = gatewayRaw.name;
      gateway.incoming = getModelPropertyAsArray(gatewayRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
      gateway.outgoing = getModelPropertyAsArray(gatewayRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);
      gateways.push(gateway);
    });

    return gateways;
  }

  private _getActivities(processData: any): Array<Model.Activities.Activity> {
    return new Array<Model.Activities.Activity>();
  }

  private _getEvents(processData: any): Array<Model.Events.Event> {

    const startEvents: Array<Model.Events.StartEvent>
      = this._parseEventsByType(processData, BpmnTags.EventElement.StartEvent, Model.Events.StartEvent);

    const boundaryEvents: Array<Model.Events.BoundaryEvent> = this._parseBoundaryEvents(processData);

    const endEvents: Array<Model.Events.EndEvent>
      = this._parseEventsByType(processData, BpmnTags.EventElement.EndEvent, Model.Events.EndEvent);

    return Array.prototype.concat(startEvents, boundaryEvents, endEvents);
  }

  private _parseBoundaryEvents(processData: any): Array<Model.Events.BoundaryEvent> {

    const events: Array<Model.Events.BoundaryEvent> = [];

    const eventsRaw: Array<Model.Events.BoundaryEvent> = getModelPropertyAsArray(processData, BpmnTags.EventElement.Boundary);

    if (!eventsRaw || eventsRaw.length === 0) {
      return [];
    }

    eventsRaw.forEach((boundaryEventRaw: any): void => {
      const event: Model.Events.BoundaryEvent = createObjectWithCommonProperties(boundaryEventRaw, Model.Events.BoundaryEvent);

      event.incoming = getModelPropertyAsArray(boundaryEventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
      event.outgoing = getModelPropertyAsArray(boundaryEventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

      event.name = boundaryEventRaw.name;
      event.attachedToRef = boundaryEventRaw.attachedToRef;
      event.cancelActivity = boundaryEventRaw.cancelActivity || true;
      event.errorEventDefinition = boundaryEventRaw[BpmnTags.FlowElementProperty.ErrorEventDefinition];

      events.push(event);
    });

    return events;
  }

  private _parseEventsByType<TEvent extends Model.Events.Event>(
    data: any,
    eventType: BpmnTags.EventElement,
    type: Model.Base.IConstructor<TEvent>,
  ): Array<TEvent> {

    const events: Array<TEvent> = [];

    const eventsRaw: Array<TEvent> = getModelPropertyAsArray(data, eventType);

    if (!eventsRaw || eventsRaw.length === 0) {
      return [];
    }

    eventsRaw.forEach((eventRaw: any): void => {
      let event: TEvent = new type();
      event = <TEvent> setCommonObjectPropertiesFromData(eventRaw, event);
      event.name = eventRaw.name;
      event.incoming = getModelPropertyAsArray(eventRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
      event.outgoing = getModelPropertyAsArray(eventRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

      events.push(event);
    });

    return events;
  }

}
