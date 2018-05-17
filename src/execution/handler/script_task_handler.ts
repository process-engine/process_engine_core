import { IToPojoOptions } from '@essential-projects/core_contracts';
import { Model, Runtime } from '@process-engine/process_engine_contracts';
import {
  IProcessModelFascade,
  IProcessTokenFascade,
  NextFlowNodeInfo,
} from './../../index';
import { IFlowNodeHandlerFactory } from './iflow_node_handler_factory';
import { FlowNodeHandler } from './index';

export class ScriptTaskHandler extends FlowNodeHandler<Model.Activities.ScriptTask> {

    protected async executeIntern(scriptTask: Model.Activities.ScriptTask, processTokenFascade: IProcessTokenFascade, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo> {

        const script = scriptTask.script;
        const context = undefined; // TODO: context needed

        if (!script) {
            return undefined;
        }

        const tokenData = await processTokenFascade.getOldTokenFormat();
        let result;

        const scriptFunction = new Function('token', 'context', script);

        result = await scriptFunction.call(this, tokenData, context);

        let finalResult = result;
        const toPojoOptions: IToPojoOptions = { skipCalculation: true };
        if (result && typeof result.toPojos === 'function') {
            finalResult = await result.toPojos(context, toPojoOptions);
        } else if (result && typeof result.toPojo === 'function') {
            finalResult = await result.toPojo(context, toPojoOptions);
        }

        await processTokenFascade.addResultForFlowNode(scriptTask.id, finalResult);

        const nextFlowNode: Model.Base.FlowNode = await processModelFascade.getNextFlowNodeFor(scriptTask);

        return new NextFlowNodeInfo(nextFlowNode, processTokenFascade);
    }
}
