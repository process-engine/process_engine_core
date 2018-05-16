import { Model, Runtime } from '@process-engine/process_engine_contracts';
import { IProcessModelFascade, IProcessTokenFascade, NextFlowNodeInfo } from './../../index';
import { FlowNodeHandler } from './index';

export class StartEventHandler extends FlowNodeHandler<Model.Events.StartEvent> {

    protected async executeIntern(flowNode: Model.Events.StartEvent, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo> {
        const nextFlowNode: Model.Base.FlowNode = await processModelFascade.getNextFlowNodeFor(flowNode);
        processTokenFascade.addResultForFlowNode(flowNode.id, {});

        return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);
    }
}
