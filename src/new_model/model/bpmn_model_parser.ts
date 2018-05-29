import {
  BpmnTags,
  Definitions,
  IModelParser,
  Model,
} from '@process-engine/process_engine_contracts';

import * as Parser from './parser';

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

    definition.collaboration = Parser.parseCollaboration(parsedXml);
    definition.processes = Parser.parseProcesses(parsedXml);

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

}
