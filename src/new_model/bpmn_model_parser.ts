import {Definitions, IModelParser, Model, Xmlns} from '@process-engine/process_engine_contracts';

import * as BluebirdPromise from 'bluebird';
import * as BpmnModdle from 'bpmn-moddle';
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
    console.log(inspect(definitions['bpmn:definitions'], inspectOptions));
    console.log('-----------------------------------------------------------');
    // ----

    return this._convertToInternalObjectModel(definitions['bpmn:definitions']);
  }

  private _convertToInternalObjectModel(parsedXml: any): Definitions {

    const definition: Definitions = this._createDefinitionBaseObject(parsedXml);

    definition.collaboration = this._getCollaboration(parsedXml['bpmn:collaboration']);
    definition.processes = this._getProcesses(parsedXml['bpmn:process']);

    return definition;
  }

  private _createDefinitionBaseObject(parsedXml: any): Definitions {

    const basicDefinition: Definitions = new Definitions();

    basicDefinition.id = parsedXml.id;
    basicDefinition.xmlns = {
      bpmn: parsedXml['xmlns:bpmn'],
      bpmndi: parsedXml['xmlns:bpmndi'],
      di: parsedXml['xmlns:di'],
      dc: parsedXml['xmlns:dc'],
      camunda: parsedXml['xmlns:camunda'],
      xsi: parsedXml['xmlns:xsi'],
    };

    basicDefinition.targetNamespace = parsedXml.targetNamespace;
    basicDefinition.exporter = parsedXml.exporter;
    basicDefinition.exporterVersion = parsedXml.exporterVersion;

    return basicDefinition;
  }

  private _getCollaboration(data: any): Model.Types.Collaboration {

    const collaboration: Model.Types.Collaboration = new Model.Types.Collaboration();

    collaboration.id = data.id;
    if (data['bpmn:documentation']) {
      collaboration.documentation.push(data['bpmn:documentation']);
    }
    collaboration.participants = this._getCollaborationParticipants(data['bpmn:participant']);

    return collaboration;
  }

  private _getCollaborationParticipants(data: any): Array<Model.Types.Participant> {

    // NOTE: Depending on how the 'bpmn:participant' tag has been formatted and the number of stored participants,
    // this can be either an Array or an Object. For easy usability, we'll always convert this to an Array, since this
    // is what our object model expects.
    const participantData: Array<any> = Array.isArray(data) ? data : [data];

    const convertedParticipants: Array<Model.Types.Participant> = [];

    participantData.forEach((participantRaw: any): void => {
        const participant: Model.Types.Participant = new Model.Types.Participant();

        participant.id = participantRaw.id;
        participant.name = participantRaw.name;
        participant.processReference = participantRaw.processRef;

        if (participantRaw['bpmn:documentation']) {
          participant.documentation.push(participantRaw['bpmn:documentation']);
        }

        convertedParticipants.push(participant);
    });

    return convertedParticipants;
  }

  private _getProcesses(data: any): Array<Model.Types.Process> {

    // NOTE: See above, this can be an Object or an Array.
    const processData: Array<any> = Array.isArray(data) ? data : [data];

    const processes: Array<Model.Types.Process> = [];

    processData.forEach((processRaw: any): void => {

      const process: Model.Types.Process = new Model.Types.Process();

      process.id = processRaw.id;
      process.name = processRaw.name;
      process.isExecutable = processRaw.isExecutable === 'true' ? true : false;

      if (processRaw['bpmn:documentation']) {
        process.documentation.push(processRaw['bpmn:documentation']);
      }

      process.laneSet = this._getProcessLaneSet(processRaw['bpmn:laneSet']);
      process.flowSequences = this._getProcessFlowSequences(processRaw['bpmn:sequenceFlow']);
      process.flowNodes = this._getProcessFlowNodes(processRaw);

      processes.push(process);
    });

    return processes;
  }

  private _getProcessLaneSet(data: any): Model.Types.LaneSet {

    const laneSet: Model.Types.LaneSet = new Model.Types.LaneSet();

    // NOTE: See above, this can be an Object or an Array.
    const lanesRaw: Array<any> = Array.isArray(data['bpmn:lane']) ? data['bpmn:lane'] : [data['bpmn:lane']];

    lanesRaw.forEach((laneRaw: any): void => {
      const lane: Model.Types.Lane = new Model.Types.Lane();

      lane.id = laneRaw.id;
      lane.name = laneRaw.name;
      lane.flowNodeReferences = laneRaw['bpmn:flowNodeRef'];

      if (data['bpmn:documentation']) {
        lane.documentation.push(data['bpmn:documentation']);
      }

      if (laneRaw['bpmn:childLaneSet']) {
        lane.childLaneSet = this._getProcessLaneSet(laneRaw['bpmn:childLaneSet']);
      }

      laneSet.lanes.push(lane);
    });

    return laneSet;
  }

  private _getProcessFlowSequences(data: any): Array<Model.Base.FlowSequence> {

    // NOTE: See above, this can be an Object or an Array (Admittedly, this is somewhat unlikely for sequences, but not impossible).
    const sequenceData: Array<any> = Array.isArray(data) ? data : [data];

    const sequences: Array<Model.Base.FlowSequence> = [];

    sequenceData.forEach((sequenceRaw: any): void => {

      const flowSequence: Model.Base.FlowSequence = new Model.Base.FlowSequence();
      flowSequence.id = sequenceRaw.id;
      flowSequence.name = sequenceRaw.name;
      flowSequence.sourceRef = sequenceRaw.sourceRef;
      flowSequence.targetRef = sequenceRaw.targetRef;

      if (data['bpmn:documentation']) {
        flowSequence.documentation.push(data['bpmn:documentation']);
      }

      if (data['bpmn:conditionExpression']) {
        const conditionData: any = data['bpmn:conditionExpression'];

        flowSequence.conditionExpression = {
          type: conditionData['xsi:type'],
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
