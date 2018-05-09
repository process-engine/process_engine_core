import { IFlowNodeHandlerFactory, IFlowNodeHandler, ScriptTaskHandler, IntermedtiateCatchEventHandler } from ".";
import { BpmnType } from "@process-engine/process_engine_contracts";
import { StartEventHandler } from "./start_event_handler";
import { EndEventHandler } from "./end_event_handler";
import { ExclusiveGatewayHandler } from "./exlusive_gateway_handler";
import { ServiceTaskHandler } from "./service_task_handler";
import { Container, IInstanceWrapper } from "addict-ioc";
import { IInvoker } from "@essential-projects/invocation_contracts";
import { ParallelGatewayHandler } from "./parallel_gateway_handler";
import { IDatastoreService } from "@essential-projects/data_model_contracts";
import { ErrorBoundaryEventHandler } from "./error_boundary_event_handler";

export class FlowNodeHandlerFactory implements IFlowNodeHandlerFactory {
    private container: Container<IInstanceWrapper<any>>;
    private invoker: IInvoker;
    private datastoreService: IDatastoreService;

    constructor(container: Container<IInstanceWrapper<any>>, invoker: IInvoker, datastoreService: IDatastoreService) {
        this.container = container;
        this.invoker = invoker;
        this.datastoreService = datastoreService;
    }

    public create(flowNodeTypeName: BpmnType): IFlowNodeHandler {
        switch (flowNodeTypeName) {
            case BpmnType.startEvent:
                return new StartEventHandler();
            case BpmnType.exclusiveGateway:
                return new ExclusiveGatewayHandler();
            case BpmnType.parallelGateway:
                return new ParallelGatewayHandler(this, this.datastoreService);
            case BpmnType.serviceTask:
                return new ServiceTaskHandler(this.container, this.invoker);
            case BpmnType.scriptTask:
                return new ErrorBoundaryEventHandler(new ScriptTaskHandler());
            case BpmnType.intermediateCatchEvent:
                return new IntermedtiateCatchEventHandler();
            case BpmnType.endEvent:
                return new EndEventHandler();
            default:
                throw Error(`Es konnte kein FlowNodeHandler für den FlowNodeType ${flowNodeTypeName} gefunden werden.`);
        }
    }
}