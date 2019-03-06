import * as fs from 'fs';
import * as should from 'should';

import * as Bluebird from 'bluebird';

Bluebird.config({
  cancellation: true,
});

global.Promise = Bluebird;

import {Model} from '@process-engine/process_model.contracts';

import {BpmnModelParser} from '../src/model/bpmn_model_parser';
import {ProcessModelFacade} from '../src/runtime';

export class TestFixtureProvider {

  private _parser: BpmnModelParser;

  public async initialize(): Promise<void> {
    this._parser = new BpmnModelParser();
    await this._parser.initialize();
  }

  public async parseProcessModelFromFile(bpmnFilename: string): Promise<Model.Process> {
    const bpmnXml: string = fs.readFileSync(bpmnFilename, 'utf8');
    const definitions: Model.Definitions = await this._parser.parseXmlToObjectModel(bpmnXml);

    return definitions.processes[0];
  }

  public createProcessModelFacade(processModel: Model.Process): ProcessModelFacade {
    return new ProcessModelFacade(processModel);
  }

  public async assertThatProcessModelHasFlowNodes(processModel: Model.Process, expectedFlowNodeIds: Array<string>): Promise<void> {

    for (const flowNodeId of expectedFlowNodeIds) {
      const flowNodeFound: boolean = processModel.flowNodes.some((flowNode: Model.Base.FlowNode) => flowNode.id === flowNodeId);

      should(flowNodeFound).be.true(`Failed to locate FlowNode '${flowNodeId}' in ProcessModel ${processModel.id}!`);
    }
  }
}
