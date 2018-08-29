// Framework imports
import * as fs from 'fs';
import * as should from 'should';

// ProcessEngine/Essential Project Imports
import {Model} from '@process-engine/process_engine_contracts';

// Local imports
import {BpmnModelParser} from '../../../src/model/bpmn_model_parser';
import {ProcessModelFacade} from '../../../src/runtime/engine';

export class ProcessModelFacadeTestFixture {

  private processModelFacade: ProcessModelFacade;

  public async initialize(bpmnFilename: string): Promise<void> {
    const parser = new BpmnModelParser();
    parser.initialize();

    const bpmnXml = fs.readFileSync(bpmnFilename, 'utf8');
    const definitions = await parser.parseXmlToObjectModel(bpmnXml);
    const process = definitions.processes[0];

    this.processModelFacade = new ProcessModelFacade(process);
  }

  public async assertFlowNodes(flowNodeIds: Array<string>): Promise<void> {
    let startEvent: Model.Base.FlowNode = this.processModelFacade.getStartEvents()[0];

    let expectedFlowNodeIds = flowNodeIds.slice(0);
    this.assertFlowNodeSequence(expectedFlowNodeIds, startEvent);

    should(expectedFlowNodeIds.length).be.eql(0);
  }

  public getFlowNodeById<TFlowNode extends Model.Base.FlowNode>(id: string): TFlowNode {
    return this.processModelFacade.getFlowNodeById(id) as TFlowNode;
  }

  /*
   * I will leave this here as discussion sample:
   *
   * This is how I would do it.
   */
  public async assertFlowNodes2(flowNodeIds: Array<string>): Promise<void> {
    const startEvent: Model.Base.FlowNode = this.processModelFacade.getStartEvents()[0];

    const expectedFlowNodeIds = flowNodeIds.slice(0);
    const totalNoOfFlowNodes: number = this.traverseAndCountFlowNodes(expectedFlowNodeIds, startEvent);

    should(totalNoOfFlowNodes).be.eql(expectedFlowNodeIds.length);
  }

  private traverseAndCountFlowNodes(flowNodeIds: Array<string>, flowNode: Model.Base.FlowNode): number {

    return this.assertFlowNodeSequence2(flowNodeIds, flowNode, 0);
  }

  private assertFlowNodeSequence2(flowNodeIds: Array<string>, flowNode: Model.Base.FlowNode, count: number): number {

    const flowNodeIsNull: boolean = flowNode == null;
    if (flowNodeIsNull) {
      // if we reach this, count will be equal to the number of flow nodes
      return count;
    }

    const [head, ...tail] = flowNodeIds;
    const expectedFlowNodeId = head;

    should(expectedFlowNodeId).be.eql(flowNode.id);

    const nextFlowNode = this.processModelFacade.getNextFlowNodeFor(flowNode);
    return this.assertFlowNodeSequence2(tail, nextFlowNode, count + 1);
  }

  private assertFlowNodeSequence(expectedFlowNodeIds: Array<string>, currentFlowNode: Model.Base.FlowNode): void {
    const expectedFlowNodeId = expectedFlowNodeIds.shift();

    should(expectedFlowNodeId).be.eql(currentFlowNode.id);

    const nextFlowNode = this.processModelFacade.getNextFlowNodeFor(currentFlowNode);

    if (nextFlowNode != null) {
      this.assertFlowNodeSequence(expectedFlowNodeIds, nextFlowNode);
    }
  }
}
