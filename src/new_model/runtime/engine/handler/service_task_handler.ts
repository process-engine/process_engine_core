import {ExecutionContext} from '@essential-projects/core_contracts';
import {IInvoker} from '@essential-projects/invocation_contracts';
import {
  IExecutionContextFacade,
  IFlowNodeInstancePersistance,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {IContainer} from 'addict-ioc';

import {FlowNodeHandler} from './index';

export class ServiceTaskHandler extends FlowNodeHandler<Model.Activities.ServiceTask> {

  private _container: IContainer;
  private _invoker: IInvoker;
  private _flowNodeInstancePersistance: IFlowNodeInstancePersistance = undefined;

  constructor(container: IContainer, invoker: IInvoker, flowNodeInstancePersistance: IFlowNodeInstancePersistance) {
    super();

    this._container = container;
    this._invoker = invoker;
    this._flowNodeInstancePersistance = flowNodeInstancePersistance;
  }

  private get container(): IContainer {
    return this._container;
  }

  private get invoker(): IInvoker {
    return this._invoker;
  }

  private get flowNodeInstancePersistance(): IFlowNodeInstancePersistance {
    return this._flowNodeInstancePersistance;
  }

  protected async executeInternally(serviceTaskNode: Model.Activities.ServiceTask,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();

    await this.flowNodeInstancePersistance.persistOnEnter(token, serviceTaskNode.id, flowNodeInstanceId);

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

      const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(serviceTaskNode);

      processTokenFacade.addResultForFlowNode(serviceTaskNode.id, result);
      await this.flowNodeInstancePersistance.persistOnExit(token, serviceTaskNode.id, flowNodeInstanceId);

      return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);

    } else {

      // TODO: implement call to webservice, which is the default in the BPMN spec
    }

  }
}
