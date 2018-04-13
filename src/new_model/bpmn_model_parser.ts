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

    definition.collaboration = this._getCollaboration(parsedXml);
    definition.processes = this._getProcesses(parsedXml);

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

  private _getCollaboration(parsedXml: any): Model.Types.Collaboration {

    const collaborationXml: any = parsedXml['bpmn:collaboration'];

    const collaborationObj: Model.Types.Collaboration = new Model.Types.Collaboration();

    collaborationObj.id = collaborationXml.id;
    if (collaborationXml['bpmn:documentation']) {
      collaborationObj.documentation.push(collaborationXml['bpmn:documentation']);
    }
    collaborationObj.participants = this._getCollaborationParticipants(collaborationXml['bpmn:participant']);

    return collaborationObj;
  }

  private _getCollaborationParticipants(data: any): Array<Model.Types.Participant> {

    // NOTE: Depending on how the 'bpmn:participant' tag has been formatted and the number of stored participants,
    // this can be either an Array or an Object. For easy usability, we'll always convert this to an Array, since this
    // is what our object model expects.
    const participantData: Array<any> = Array.isArray(data) ? data : [data];

    const convertedParticipants: Array<Model.Types.Participant> = [];

    participantData.forEach((participant: any) => {
        const participantObj: Model.Types.Participant = new Model.Types.Participant();
        participantObj.id = participant.id;
        participantObj.name = participant.name;
        if (participant['bpmn:documentation']) {
          participantObj.documentation.push(participant['bpmn:documentation']);
        }
        participantObj.processReference = participant.processRef;

        convertedParticipants.push(participantObj);
    });

    return convertedParticipants;
  }

  private _getProcesses(parsedXml: any): Array<Model.Types.Process> {

    const processes: Array<Model.Types.Process> = [];

    // parsedXml.rootElements.forEach((root: any) => {

    //   if (root.$type === 'bpmn:Process') {
    //     const process: Model.Types.Process = new Model.Types.Process();
    //     process.id = root.id;
    //     process.name = root.name;
    //     process.items = root.flowElements;
    //     process.laneSets = [];
    //     processes.push(root);
    //   }
    // });

    return processes;
  }

}
