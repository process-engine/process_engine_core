import {
  BpmnTags,
  Definitions,
  IModelParser,
  Model,
} from '@process-engine/process_engine_contracts';

import * as BluebirdPromise from 'bluebird';
import * as BpmnModdle from 'bpmn-moddle';
import {inspect} from 'util'; // For testing purposes; Remove after implementation is finished
import * as xml2js from 'xml2js';

function getModelPropertyAsArray(model: any, elementName: string): any {

  if (!model[elementName]) {
    return undefined;
  }

  return Array.isArray(model[elementName]) ? model[elementName] : [model[elementName]];
}

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
    console.log(inspect(definitions[BpmnTags.RootElement.Definitions], inspectOptions));
    console.log('-----------------------------------------------------------');
    // ----

    return this._convertToInternalObjectModel(definitions[BpmnTags.RootElement.Definitions]);
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

    const collaborationData: any = data[BpmnTags.RootElement.Collaboration];

    const collaboration: Model.Types.Collaboration = new Model.Types.Collaboration();

    collaboration.id = collaborationData.id;
    if (collaborationData[BpmnTags.FlowElementProperty.Documentation]) {
      collaboration.documentation.push(collaborationData[BpmnTags.FlowElementProperty.Documentation]);
    }

    collaboration.participants = this._getCollaborationParticipants(collaborationData);

    return collaboration;
  }

  private _getCollaborationParticipants(collaborationData: any): Array<Model.Types.Participant> {

    // NOTE: Depending on how the 'bpmn:participant' tag has been formatted and the number of stored participants,
    // this can be either an Array or an Object. For easy usability, we'll always convert this to an Array, since this
    // is what our object model expects.
    const participantData: Array<any> = getModelPropertyAsArray(collaborationData, BpmnTags.RootElement.Participant);

    const convertedParticipants: Array<Model.Types.Participant> = [];

    participantData.forEach((participantRaw: any): void => {
        const participant: Model.Types.Participant = new Model.Types.Participant();

        participant.id = participantRaw.id;
        participant.name = participantRaw.name;
        participant.processReference = participantRaw.processRef;

        if (participantRaw[BpmnTags.FlowElementProperty.Documentation]) {
          participant.documentation.push(participantRaw[BpmnTags.FlowElementProperty.Documentation]);
        }

        convertedParticipants.push(participant);
    });

    return convertedParticipants;
  }

  private _getProcesses(data: any): Array<Model.Types.Process> {

    // NOTE: See above, this can be an Object or an Array.
    const processData: Array<any> = getModelPropertyAsArray(data, BpmnTags.RootElement.Process);

    const processes: Array<Model.Types.Process> = [];

    processData.forEach((processRaw: any): void => {

      const process: Model.Types.Process = new Model.Types.Process();

      process.id = processRaw.id;
      process.name = processRaw.name;
      process.isExecutable = processRaw.isExecutable === 'true' ? true : false;

      if (processRaw[BpmnTags.FlowElementProperty.Documentation]) {
        process.documentation.push(processRaw[BpmnTags.FlowElementProperty.Documentation]);
      }

      process.laneSet = this._getProcessLaneSet(processRaw);
      process.flowSequences = this._getProcessFlowSequences(processRaw);
      process.flowNodes = this._getProcessFlowNodes(processRaw);

      processes.push(process);
    });

    return processes;
  }

  private _getProcessLaneSet(data: any): Model.Types.LaneSet {

    const laneSetData: any = data[BpmnTags.Lane.LaneSet] || data[BpmnTags.LaneProperty.ChildLaneSet];

    // NOTE: See above, this can be an Object or an Array.
    const lanesRaw: Array<any> = getModelPropertyAsArray(laneSetData, BpmnTags.Lane.Lane);

    const laneSet: Model.Types.LaneSet = new Model.Types.LaneSet();

    lanesRaw.forEach((laneRaw: any): void => {
      const lane: Model.Types.Lane = new Model.Types.Lane();

      lane.id = laneRaw.id;
      lane.name = laneRaw.name;
      lane.flowNodeReferences = laneRaw[BpmnTags.LaneProperty.FlowNodeRef];

      if (laneSetData[BpmnTags.FlowElementProperty.Documentation]) {
        lane.documentation.push(data[BpmnTags.FlowElementProperty.Documentation]);
      }

      if (laneRaw[BpmnTags.LaneProperty.ChildLaneSet]) {
        lane.childLaneSet = this._getProcessLaneSet(laneRaw);
      }

      laneSet.lanes.push(lane);
    });

    return laneSet;
  }

  private _getProcessFlowSequences(data: any): Array<Model.Base.FlowSequence> {

    // NOTE: See above, this can be an Object or an Array (Admittedly, this is somewhat unlikely for sequences, but not impossible).
    const sequenceData: Array<any> = getModelPropertyAsArray(data, BpmnTags.FlowElement.SequenceFlow);

    const sequences: Array<Model.Base.FlowSequence> = [];

    sequenceData.forEach((sequenceRaw: any): void => {

      const flowSequence: Model.Base.FlowSequence = new Model.Base.FlowSequence();
      flowSequence.id = sequenceRaw.id;
      flowSequence.name = sequenceRaw.name;
      flowSequence.sourceRef = sequenceRaw.sourceRef;
      flowSequence.targetRef = sequenceRaw.targetRef;

      if (data[BpmnTags.FlowElementProperty.Documentation]) {
        flowSequence.documentation.push(data[BpmnTags.FlowElementProperty.Documentation]);
      }

      if (data[BpmnTags.FlowElementProperty.ConditionExpression]) {
        const conditionData: any = data[BpmnTags.FlowElementProperty.ConditionExpression];

        flowSequence.conditionExpression = {
          type: conditionData[BpmnTags.FlowElementProperty.XsiType],
          expression: conditionData._,
        };
      }

      sequences.push(flowSequence);
    });

    return sequences;
  }

  // TODO
  private _getProcessFlowNodes(data: any): Array<Model.Base.FlowNode> {

    // NOTE: See above, this can be an Object or an Array.
    const nodeData: Array<any> = Array.isArray(data) ? data : [data];

    return new Array<Model.Base.FlowNode>();
  }

}
