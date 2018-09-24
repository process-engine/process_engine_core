import * as fs from 'fs';
import * as should from 'should';

import {Definitions, Model} from '@process-engine/process_engine_contracts';

import {BpmnModelParser} from '../../../src/model/bpmn_model_parser';
import {ProcessModelFacade} from '../../../src/runtime/engine';

export class ProcessModelFacadeTestFixture {

  private processModelFacade: ProcessModelFacade;

  public async initialize(bpmnFilename: string): Promise<void> {
    const parser: BpmnModelParser = new BpmnModelParser();
    parser.initialize();

    const bpmnXml: string = fs.readFileSync(bpmnFilename, 'utf8');
    const definitions: Definitions = await parser.parseXmlToObjectModel(bpmnXml);
    const process: Model.Types.Process = definitions.processes[0];

    this.processModelFacade = new ProcessModelFacade(process);
  }

  public async assertFlowNodes(flowNodeIds: Array<string>): Promise<void> {
    const startEvent: Model.Base.FlowNode = this.processModelFacade.getStartEvents()[0];

    const expectedFlowNodeIds: Array<string> = flowNodeIds.slice(0);
    this.assertFlowNodeSequence(expectedFlowNodeIds, startEvent);

    should(expectedFlowNodeIds.length).be.eql(0);
  }

  public getFlowNodeById<TFlowNode extends Model.Base.FlowNode>(id: string): TFlowNode {
    return this.processModelFacade.getFlowNodeById(id) as TFlowNode;
  }

  private assertFlowNodeSequence(expectedFlowNodeIds: Array<string>, currentFlowNode: Model.Base.FlowNode): void {
    const expectedFlowNodeId: string = expectedFlowNodeIds.shift();

    should(expectedFlowNodeId).be.eql(currentFlowNode.id);

    const nextFlowNode: Model.Base.FlowNode = this.processModelFacade.getNextFlowNodeFor(currentFlowNode);

    if (nextFlowNode !== null) {
      this.assertFlowNodeSequence(expectedFlowNodeIds, nextFlowNode);
    }
  }
}
