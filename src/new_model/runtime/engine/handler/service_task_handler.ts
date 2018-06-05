import { ExecutionContext, IToPojoOptions } from '@essential-projects/core_contracts';
import { IInvoker } from '@essential-projects/invocation_contracts';
import { IExecutionContextFacade, IProcessModelFacade, IProcessTokenFacade, Model,
  NextFlowNodeInfo, Runtime } from '@process-engine/process_engine_contracts';
import { IContainer } from 'addict-ioc';
import { FlowNodeHandler } from './index';

export class ServiceTaskHandler extends FlowNodeHandler<Model.Activities.ServiceTask> {
  private _container: IContainer;
  private _invoker: IInvoker;

  constructor(container: IContainer, invoker: IInvoker) {
    super();

    this._container = container;
    this._invoker = invoker;
  }

  private get container(): IContainer {
    return this._container;
  }

  private get invoker(): IInvoker {
    return this._invoker;
  }

  protected async executeInternally(serviceTaskNode: Model.Activities.ServiceTask,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const context: ExecutionContext = executionContextFacade.getExecutionContext();
    const isMethodInvocation: boolean = serviceTaskNode.invocation instanceof Model.Activities.MethodInvocation;
    const tokenData: any = await processTokenFacade.getOldTokenFormat();

    if (isMethodInvocation) {

      const invocation: Model.Activities.MethodInvocation = serviceTaskNode.invocation as Model.Activities.MethodInvocation;

      const serviceInstance: any = await this.container.resolveAsync(invocation.module);

      const evaluateParamsFunction: Function = new Function('context', 'token', `return ${invocation.params}`);
      const argumentsToPassThrough: Array<any> = evaluateParamsFunction.call(tokenData, context, tokenData) || [];

      const serviceMethod: Function = serviceInstance[invocation.method];

      if (!serviceMethod) {
        throw new Error(`method "${invocation.method}" is missing`);
      }

      const result: any = await serviceMethod.call(serviceInstance, ...argumentsToPassThrough);

      processTokenFacade.addResultForFlowNode(serviceTaskNode.id, result);

      const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(serviceTaskNode);

      return new NextFlowNodeInfo(nextFlowNode, processTokenFacade);

    } else {

      // TODO: implement call to webservice, which is the default in the BPMN spec
    }

  }
}
