import {
  BpmnTags,
  Definitions,
  IModelParser,
  Model,
} from '@process-engine/process_engine_contracts';

import * as FlowNodeParser from './parser';

import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
} from './type_factory';

import * as BluebirdPromise from 'bluebird';
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
    const sequenceData: Array<any> = getModelPropertyAsArray(data, BpmnTags.OtherElements.SequenceFlow);

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

  // TODO: The following elements are not supported yet:
  // - Text annotations
  // - Associations
  // - Intermediate Catch- & Throw- Events of any kind
  // - Subprocess
  private _getProcessFlowNodes(processData: any): Array<Model.Base.FlowNode> {

    let nodes: Array<Model.Base.FlowNode> = [];

    const events: Array<Model.Events.Event> = FlowNodeParser.parseEventsFromProcessData(processData);
    const gateways: Array<Model.Gateways.Gateway> = FlowNodeParser.parseGatewaysFromProcessData(processData);
    const tasks: Array<Model.Activities.Activity> = FlowNodeParser.parseActivitiesFromProcessData(processData);

    nodes = nodes.concat(gateways, tasks, events);

    return nodes;
  }

}
