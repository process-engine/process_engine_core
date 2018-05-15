import { FlowNodeHandler, NextFlowNodeInfo, IProcessModelFascade, IProcessTokenFascade } from './../index';
import { Model, Runtime } from "@process-engine/process_engine_contracts";
import { ExecutionContext, IToPojoOptions } from "@essential-projects/core_contracts";
import { IContainer } from 'addict-ioc';
import { IInvoker } from "@essential-projects/invocation_contracts";

export class ServiceTaskHandler extends FlowNodeHandler<Model.Activities.ServiceTask> {
    private container: IContainer;
    private invoker: IInvoker;

    constructor(container: IContainer, invoker: IInvoker) {
        super();

        this.container = container;
        this.invoker = invoker;
    }

    protected async executeIntern(serviceTaskNode: Model.Activities.ServiceTask, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo> {
        
        const context = undefined; // TODO: context needed
        const isMethodInvocation: boolean = serviceTaskNode.invocation instanceof Model.Activities.MethodInvocation;
        const tokenData: any = processTokenFascade.getOldTokenFormat();

        if (isMethodInvocation) {

            const invocation: Model.Activities.MethodInvocation = serviceTaskNode.invocation as Model.Activities.MethodInvocation;

            const serviceInstance = await this.container.resolveAsync(invocation.module);
            
            let result;

            try {
                const namespace: any = undefined; // TODO: SM: I think we agreed, that the namespace feature should be removed in the future
                
                const argumentsToPassThrough = (new Function('context', 'token', 'callback', 'return ' + invocation.params)).call(tokenData, context, tokenData) || [];
                result = await this.invoker.invoke(serviceInstance, invocation.method, undefined, namespace, ...argumentsToPassThrough);
                
            } catch (error) {
                
                result = error;
            }

            processTokenFascade.addResultForFlowNode(serviceTaskNode.id, result);
            
            const nextFlowNode: Model.Base.FlowNode = processModelFascade.getNextFlowNodeFor(serviceTaskNode);
            return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);
            
        } else {

            // TODO: implement call to webservice, which is the default in the
            // BPMN spec
        }

    }
}