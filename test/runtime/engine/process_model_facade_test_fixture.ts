import * as fs from 'fs';
import * as should from 'should';

import {Model} from '@process-engine/process_model.contracts';

import {BpmnModelParser} from '../../../src/model/bpmn_model_parser';
import {ProcessModelFacade} from '../../../src/runtime';

export class ProcessModelFacadeTestFixture {

  private processModelFacade: ProcessModelFacade;

  public async initialize(bpmnFilename: string): Promise<void> {
    const parser: BpmnModelParser = new BpmnModelParser();
    parser.initialize();

    const bpmnXml: string = fs.readFileSync(bpmnFilename, 'utf8');
    const definitions: Model.Definitions = await parser.parseXmlToObjectModel(bpmnXml);
    const process: Model.Process = definitions.processes[0];

    this.processModelFacade = new ProcessModelFacade(process);
  }

  public async assertFlowNodes(expectedFlowNodeIds: Array<string>): Promise<void> {
    const startEvent: Model.Base.FlowNode = this.processModelFacade.getStartEvents()[0];

    this.assertFlowNodeSequence(expectedFlowNodeIds, startEvent);
  }

  public getFlowNodeById<TFlowNode extends Model.Base.FlowNode>(id: string): TFlowNode {
    return this.processModelFacade.getFlowNodeById(id) as TFlowNode;
  }

  private assertFlowNodeSequence(expectedFlowNodeIds: Array<string>, currentFlowNode: Model.Base.FlowNode): void {

    should(expectedFlowNodeIds).containEql(currentFlowNode.id);

    const nextFlowNodes: Array<Model.Base.FlowNode> = this.processModelFacade.getNextFlowNodesFor(currentFlowNode);

    if (nextFlowNodes && nextFlowNodes.length > 0) {
      for (const nextFlowNode of nextFlowNodes) {
        this.assertFlowNodeSequence(expectedFlowNodeIds, nextFlowNode);
      }
    }
  }
}
