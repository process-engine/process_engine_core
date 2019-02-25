import {
  IModelParser,
  IParsedObjectModel,
  Model,
} from '@process-engine/process_model.contracts';

import * as Parser from './parser';

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

  public async parseXmlToObjectModel(xml: string): Promise<Model.Definitions> {

    const parsedObjectModel: IParsedObjectModel = await this._parseObjectModel(xml);
    const definitions: Model.Definitions = Parser.parseDefinitions(parsedObjectModel);

    return definitions;
  }

  private async _parseObjectModel(xml: string): Promise<IParsedObjectModel> {
    const parsedXml: any = await this._xmlParserFunc(xml);

    return parsedXml;
  }

}
