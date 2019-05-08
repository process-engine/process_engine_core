import * as xml2js from 'xml2js';

import {
  IModelParser,
  IParsedObjectModel,
  Model,
} from '@process-engine/process_model.contracts';

import {Parsers} from './parser';

export class BpmnModelParser implements IModelParser {

  public config: any;

  private xmlParser: xml2js.Parser = undefined;
  private xmlParserFunc: Function = undefined;

  private xmlParserOptions: any = {
    explicitArray: false,
    mergeAttrs: true,
  };

  public async initialize(): Promise<void> {
    this.xmlParser = new xml2js.Parser(this.xmlParserOptions);
    this.xmlParserFunc = Promise.promisify(this.xmlParser.parseString, {
      context: this.xmlParser,
    });
  }

  public async parseXmlToObjectModel(xml: string): Promise<Model.Definitions> {

    const parsedObjectModel: IParsedObjectModel = await this.parseObjectModel(xml);
    const definitions: Model.Definitions = Parsers.DefinitionParser.parseDefinitions(parsedObjectModel);

    return definitions;
  }

  private async parseObjectModel(xml: string): Promise<IParsedObjectModel> {
    const parsedXml: any = await this.xmlParserFunc(xml);

    return parsedXml;
  }

}
