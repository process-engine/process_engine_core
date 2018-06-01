import { ExecutionContext, IToPojoOptions } from '@essential-projects/core_contracts';
import { IExecutionContextFacade, IFlowNodeHandlerFactory, IProcessModelFacade, IProcessTokenFacade,
  Model, NextFlowNodeInfo, Runtime } from '@process-engine/process_engine_contracts';
import { FlowNodeHandler } from './index';

export class ScriptTaskHandler extends FlowNodeHandler<Model.Activities.ScriptTask> {

  protected async executeIntern(scriptTask: Model.Activities.ScriptTask,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const script: string = scriptTask.script;
    const context: ExecutionContext = undefined; // TODO: context needed

    if (!script) {
      return undefined;
    }

    const tokenData: any = await processTokenFacade.getOldTokenFormat();
    let result: any;

    const scriptFunction: Function = new Function('token', 'context', script);

    result = await scriptFunction.call(this, tokenData, context);

    let finalResult: any = result;
    const toPojoOptions: IToPojoOptions = { skipCalculation: true };
    if (result && typeof result.toPojos === 'function') {
      finalResult = await result.toPojos(context, toPojoOptions);
    } else if (result && typeof result.toPojo === 'function') {
      finalResult = await result.toPojo(context, toPojoOptions);
    }

    await processTokenFacade.addResultForFlowNode(scriptTask.id, finalResult);

    const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(scriptTask);

    return new NextFlowNodeInfo(nextFlowNode, processTokenFacade);
  }
}