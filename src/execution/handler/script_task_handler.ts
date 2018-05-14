import { FlowNodeHandler, NextFlowNodeInfo, IProcessModelFascade, IProcessEngineStorageService } from './../index';
import { INodeDefEntity, IProcessTokenEntity } from "@process-engine/process_engine_contracts";
import { ExecutionContext, IToPojoOptions } from "@essential-projects/core_contracts";
import { Model, Runtime } from "@process-engine/process_engine_contracts";

export class ScriptTaskHandler extends FlowNodeHandler {

    protected async executeIntern(scriptTask: Model.Base.FlowNode, processToken: Runtime.Types.ProcessToken, processModelFascade: IProcessModelFascade): Promise<NextFlowNodeInfo> {
        const tokenData = processToken.data || {};
        let result;
        const script = (scriptTask as Model.Activities.ScriptTask).script;

        if (script) {
            const scriptFunction = new Function('token', 'context', script);
            result = await scriptFunction.call(this, tokenData, context);

            let finalResult = result;
            const toPojoOptions: IToPojoOptions = { skipCalculation: true };
            if (result && typeof result.toPojos === 'function') {
                finalResult = await result.toPojos(context, toPojoOptions);
            } else if (result && typeof result.toPojo === 'function') {
                finalResult = await result.toPojo(context, toPojoOptions);
            }

            tokenData.current = finalResult;
            processToken.data = tokenData;

            const nextFlowNode: Model.Base.FlowNode = await processModelFascade.getNextFlowNodeFor(scriptTask); 
            return new NextFlowNodeInfo(nextFlowNode, processToken);
        }
    }
}