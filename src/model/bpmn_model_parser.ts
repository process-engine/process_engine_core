import * as xml2js from 'xml2js';

import {IModelParser, Model} from '@process-engine/persistence_api.contracts';

import {parseDefinitions} from './parser';

export class BpmnModelParser implements IModelParser {

  public config: any;

  private xmlParser: xml2js.Parser = undefined;
  private xmlParserFunc: Function = undefined;

  private xmlParserOptions = {
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
    const parsedObjectModel = await this.xmlParserFunc(xml);
    const definitions = parseDefinitions(parsedObjectModel);

    return definitions;
  }

}
