import {Definitions, IModelReader, Model} from '@process-engine/process_engine_contracts';

import * as BluebirdPromise from 'bluebird';
import * as BpmnModdle from 'bpmn-moddle';

export class BpmnModelReader implements IModelReader {

  public async read(xml: string): Promise<Definitions> {

    const moddle: BpmnModdle = BpmnModdle();

    return <any> (new BluebirdPromise<Definitions>((resolve: Function, reject: Function): void => {

      moddle.fromXML(xml, (error: Error, definitions: any) => {
        if (error) {
          return reject(error);
        }

        const bpmnDiagram: Definitions = this._createDefinitionsFromParsedXml(definitions);

        return resolve(bpmnDiagram);
      });
    }));
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
