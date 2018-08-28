const fs = require("fs");
const should = require('should');

import { BpmnModelParser } from '../../../src/model/bpmn_model_parser';
import { ProcessModelFacade } from '../../../src/runtime/engine';
import { Model } from '@process-engine/process_engine_contracts';

export class ProcessModelFacadeTestFixture {

    public async createTestObject(bpmnFilename: string): Promise<ProcessModelFacade> {
        const parser = new BpmnModelParser();
        parser.initialize();
        const definitions = await parser.parseXmlToObjectModel(fs.readFileSync(bpmnFilename, 'utf8'));
        const process = definitions.processes[0];

        return new ProcessModelFacade(process);
    }

    public async assertFlowNodes(flowNodeIds: Array<string>, processModelFacade: ProcessModelFacade): Promise<void> {
        let currentFlowNode: Model.Base.FlowNode = processModelFacade.getStartEvents()[0];
        let counter = 0;
        while (currentFlowNode != null) {
            should(flowNodeIds[counter]).be.eql(currentFlowNode.id);

            currentFlowNode = processModelFacade.getNextFlowNodeFor(currentFlowNode);
            counter++;
        }
    }

    public getFlowNodeById<TFlowNode extends Model.Base.FlowNode>(id: string, processModelFacade: ProcessModelFacade): TFlowNode {
        return processModelFacade.getFlowNodeById(id) as TFlowNode;
    }
}
