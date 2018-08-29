// Framework imports
import * as fs from 'fs';
import * as should from 'should';

// ProcessEngine/Essential Project Imports
import { Model } from '@process-engine/process_engine_contracts';

// Local imports
import { BpmnModelParser } from '../../../src/model/bpmn_model_parser';
import { ProcessModelFacade } from '../../../src/runtime/engine';

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
        let currentFlowNode: Model.Base.FlowNode = this.processModelFacade.getStartEvents()[0];
        let flowNodeIdIndex = 0;

        while (this.hasNextNextFlowNode(currentFlowNode)) {

            should(flowNodeIds[flowNodeIdIndex]).be.eql(currentFlowNode.id);

            currentFlowNode = this.processModelFacade.getNextFlowNodeFor(currentFlowNode);
            flowNodeIdIndex++;
        }

        should(flowNodeIdIndex).be.eql(flowNodeIds.length);
    }

    public getFlowNodeById<TFlowNode extends Model.Base.FlowNode>(id: string): TFlowNode {
        return this.processModelFacade.getFlowNodeById(id) as TFlowNode;
    }

    private hasNextNextFlowNode(flowNode: Model.Base.FlowNode): boolean {
        return flowNode != null;
    }
}
