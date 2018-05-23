import { ExecutionContext, IToPojoOptions } from '@essential-projects/core_contracts';
import { IInvoker } from '@essential-projects/invocation_contracts';
import { Model, Runtime } from '@process-engine/process_engine_contracts';
import { IContainer } from 'addict-ioc';
import { IProcessModelFascade, IProcessTokenFascade, NextFlowNodeInfo } from './../../index';
import { FlowNodeHandler } from './index';

export class ServiceTaskHandler extends FlowNodeHandler<Model.Activities.ServiceTask> {
  private container: IContainer;
  private invoker: IInvoker;

  constructor(container: IContainer, invoker: IInvoker) {
    super();

    this.container = container;
    this.invoker = invoker;
  }

  protected async executeIntern(serviceTaskNode: Model.Activities.ServiceTask,
                                processTokenFascade: IProcessTokenFascade,
                                processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo> {

    const context: ExecutionContext = undefined; // TODO: context needed
    const isMethodInvocation: boolean = serviceTaskNode.invocation instanceof Model.Activities.MethodInvocation;
    const tokenData: any = await processTokenFascade.getOldTokenFormat();

    if (isMethodInvocation) {

      const invocation: Model.Activities.MethodInvocation = serviceTaskNode.invocation as Model.Activities.MethodInvocation;

      const serviceInstance: any = await this.container.resolveAsync(invocation.module);

      // tslint:disable-next-line:max-line-length
      const argumentsToPassThrough: Array<any> = (new Function('context', 'token', 'return ' + invocation.params)).call(tokenData, context, tokenData) || [];

      const serviceMethod: Function = serviceInstance[invocation.method];

      if (!serviceMethod) {
        throw new Error(`method "${invocation.method}" is missing`);
      }

      const result: any = await serviceMethod.call(serviceInstance, ...argumentsToPassThrough);

      processTokenFascade.addResultForFlowNode(serviceTaskNode.id, result);

      const nextFlowNode: Model.Base.FlowNode = processModelFascade.getNextFlowNodeFor(serviceTaskNode);

      return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);

    } else {

      // TODO: implement call to webservice, which is the default in the
      // BPMN spec
    }

  }
}
