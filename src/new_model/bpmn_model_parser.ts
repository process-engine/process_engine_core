import {Definitions, IModelParser, Model} from '@process-engine/process_engine_contracts';

import * as BluebirdPromise from 'bluebird';
import * as BpmnModdle from 'bpmn-moddle';
import {inspect} from 'util'; // For testing purposes; Remove after implementation is finished
import * as xml2js from 'xml2js';

export class BpmnModelParser implements IModelParser {

  private _xmlParser: xml2js.Parser = undefined;
  private _xmlParserFunc: Function = undefined;

  constructor() {

    const xmlParserOptions: any = {
      explicitArray: false,
      mergeAttrs: true,
    };

    this._xmlParser = new xml2js.Parser(xmlParserOptions);
    this._xmlParserFunc = BluebirdPromise.promisify(this._xmlParser.parseString, {
      context: this._xmlParser,
    });
  }

  public async parseXmlToObjectModel(xml: string): Promise<Definitions> {

    const result: any = await this._xmlParserFunc(xml);

    // For testing purposes; Remove after implementation is finished
    const inspectOptions: any = {
      showHidden: false,
      depth: 9,
      maxArrayLength: 100,
    };
    console.log('---------------XML2JS PARSE RESULT ------------------------');
    console.log(inspect(result, inspectOptions));
    console.log('-----------------------------------------------------------');
    // ----


    const moddle: BpmnModdle = BpmnModdle();

    return <any> new BluebirdPromise<Definitions>((resolve: Function, reject: Function): void => {

      moddle.fromXML(xml, (error: Error, definitions: any) => {
        if (error) {
          return reject(error);
        }

        // For testing purposes; Remove after implementation is finished
        const inspectOptions: any = {
          showHidden: false,
          depth: 9,
          maxArrayLength: 100,
        };
        console.log('---------------BPMN MODDLE RESULT ------------------------');
        console.log(inspect(definitions, inspectOptions));
        console.log('----------------------------------------------------------');
        // ----

        const bpmnDiagram: Definitions = this._createDefinitionsFromParsedXml(definitions);

        return resolve(bpmnDiagram);
      });
    });
  }

  private _createDefinitionsFromParsedXml(parsedXml: any): Definitions {
    const bpmnDiagram: Definitions = new Definitions();

    bpmnDiagram.name = parsedXml.name;
    bpmnDiagram.id = parsedXml.id;
    bpmnDiagram.items = this._getProcessesFromDefinitions(parsedXml);

    return bpmnDiagram;
  }

  private _getProcessesFromDefinitions(parsedXml: any): Array<Model.Types.Process> {

    const processes: Array<Model.Types.Process> = [];

    parsedXml.rootElements.forEach((root: any) => {

      if (root.$type === 'bpmn:Process') {
        const process: Model.Types.Process = new Model.Types.Process();
        process.id = root.id;
        process.name = root.name;
        process.items = root.flowElements;
        process.laneSets = [];
        processes.push(root);
      }
    });

    return processes;
  }

}
