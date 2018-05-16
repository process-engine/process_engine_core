import { Model, Runtime } from '@process-engine/process_engine_contracts';
import {
  IProcessModelFascade,
  IProcessTokenFascade,
  NextFlowNodeInfo,
} from './../../index';
import { FlowNodeHandler } from './index';

export class ErrorBoundaryEventHandler extends FlowNodeHandler<Model.Events.BoundaryEvent> {
    private activityHandler: FlowNodeHandler<Model.Base.FlowNode>;

    constructor(activityHandler: FlowNodeHandler<Model.Base.FlowNode>) {
        super();
        this.activityHandler = activityHandler;
    }

    protected async executeIntern(flowNode: Model.Events.BoundaryEvent, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo> {
        try {
            const nextFlowNodeInfo: NextFlowNodeInfo = await this.activityHandler.execute(flowNode, processTokenFascade, processModelFascade);

            return nextFlowNodeInfo;
        } catch (err) {
            const boundaryEvent: Model.Events.BoundaryEvent = processModelFascade.getBoundaryEventsFor(flowNode)[0];

            const nextFlowNode: Model.Base.FlowNode = processModelFascade.getNextFlowNodeFor(flowNode);

            return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);
        }
    }
}
