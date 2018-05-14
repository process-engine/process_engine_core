import { FlowNodeHandler, NextFlowNodeInfo, IProcessModelFascade, IProcessEngineStorageService } from './../index';
import { ServiceTaskExtensions } from "./service_task_extensions"
import { Model, Runtime } from "@process-engine/process_engine_contracts";
import { ExecutionContext, IToPojoOptions } from "@essential-projects/core_contracts";
import { Container, IInstanceWrapper } from 'addict-ioc';
import { IInvoker } from "@essential-projects/invocation_contracts";

export class ServiceTaskHandler extends FlowNodeHandler {
    private container: Container<IInstanceWrapper<any>>;
    private invoker: IInvoker;

    constructor(container: Container<IInstanceWrapper<any>>, invoker: IInvoker) {
        super();

        this.container = container;
        this.invoker = invoker;
    }

    protected async executeIntern(flowNode: Model.Base.FlowNode, processToken: Runtime.Types.ProcessToken, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo> {
        const tokenData = processToken.data || {};
        const serviceTaskExtensions = new ServiceTaskExtensions(flowNode.extensions);

        if (serviceTaskExtensions.isValid) {

            const serviceInstance = await this.container.resolveAsync(serviceTaskExtensions.module);

            let result;

            try {
                const self = this;                
                
                const cb = function(data) {
                };

                const argumentsToPassThrough = (new Function('context', 'token', 'callback', 'return ' + serviceTaskExtensions.parameter)).call(tokenData, context, tokenData, cb) || [];
                result = await this.invoker.invoke(serviceInstance, serviceTaskExtensions.method, serviceTaskExtensions.namspace, context, ...argumentsToPassThrough);

            } catch (err) {
                result = err;
            }

            let finalResult = result;
            const toPojoOptions: IToPojoOptions = { skipCalculation: true };
            if (result && typeof result.toPojos === 'function') {
                finalResult = await result.toPojos(context, toPojoOptions);
            } else if (result && typeof result.toPojo === 'function') {
                finalResult = await result.toPojo(context, toPojoOptions);
            }

            tokenData.current = finalResult;
            processToken.data = tokenData;

            return new NextFlowNodeInfo(await this.getNextFlowNodeFor(flowNode, context), processToken);
        }
    }
}