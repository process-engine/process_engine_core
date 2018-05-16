import { BpmnType, Model } from '@process-engine/process_engine_contracts';
import { IContainer } from 'addict-ioc';
import { IFlowNodeHandler, IFlowNodeHandlerFactory } from '.';

export class FlowNodeHandlerFactory implements IFlowNodeHandlerFactory {

    private container: IContainer;

    constructor(container: IContainer) {
        this.container = container;
    }

    public create<TFlowNode extends Model.Base.FlowNode>(flowNode: TFlowNode): Promise<IFlowNodeHandler<TFlowNode>> {
        return this._create<TFlowNode>(flowNode.bpmnType);
    }

    private async _create<TFlowNode extends Model.Base.FlowNode>(type: BpmnType): Promise<IFlowNodeHandler<TFlowNode>> {
        switch (type) {
            case BpmnType.startEvent:
                return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('StartEventHandler');
            case BpmnType.exclusiveGateway:
                return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('ExclusiveGatewayHandler');
            case BpmnType.parallelGateway:
                return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('ParallelGatewayHandler');
            case BpmnType.serviceTask:
                return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('ServiceTaskHandler');
            case BpmnType.scriptTask:
                const flowNodeHandler: IFlowNodeHandler<Model.Activities.ScriptTask> =
                    await this.container.resolveAsync<IFlowNodeHandler<Model.Activities.ScriptTask>>('ScriptTaskHandler');

                return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('ErrorBoundaryEventHandler', [flowNodeHandler]);
            case BpmnType.intermediateCatchEvent:
                return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('IntermediateCatchEventHandler');
            case BpmnType.intermediateThrowEvent:
                return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('IntermediateThrowEventHandler');
            case BpmnType.endEvent:
                return this.container.resolveAsync<IFlowNodeHandler<TFlowNode>>('EndEventHandler');
            default:
                throw Error(`Es konnte kein FlowNodeHandler für den FlowNodeType ${type} gefunden werden.`);
        }
    }
}
