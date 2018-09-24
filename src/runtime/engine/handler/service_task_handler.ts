import {IIdentity} from '@essential-projects/iam_contracts';

import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  IFlowNodeInstanceService,
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

  constructor(container: IContainer, flowNodeInstanceService: IFlowNodeInstanceService, metricsService: IMetricsApi) {
    super(flowNodeInstanceService, metricsService);

    this._container = container;
  }

  private get container(): IContainer {
    return this._container;
  }

  protected async executeInternally(serviceTask: Model.Activities.ServiceTask,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(serviceTask, token);

    const isMethodInvocation: boolean = serviceTask.invocation instanceof Model.Activities.MethodInvocation;
    const tokenData: any = await processTokenFacade.getOldTokenFormat();

    if (isMethodInvocation) {

      const invocation: Model.Activities.MethodInvocation = serviceTask.invocation as Model.Activities.MethodInvocation;

      const serviceInstance: any = await this.container.resolveAsync(invocation.module);

      const evaluateParamsFunction: Function = new Function('context', 'token', `return ${invocation.params}`);
      const argumentsToPassThrough: Array<any> = evaluateParamsFunction.call(tokenData, context, tokenData) || [];

      const serviceMethod: Function = serviceInstance[invocation.method];

      if (!serviceMethod) {
        const error: Error = new Error(`Method '${invocation.method}' not found on target module '${invocation.module}'!`);
        await this.persistOnError(serviceTask, token, error);
        throw error;
      }

      const result: any = await serviceMethod.call(serviceInstance, ...argumentsToPassThrough);

      const finalResult: any = result === undefined ? null : result;

      processTokenFacade.addResultForFlowNode(serviceTask.id, result);
      token.payload = finalResult;
    }

    await this.persistOnExit(serviceTask, token);

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(serviceTask);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }
}
