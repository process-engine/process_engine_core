import { FlowNodeHandler } from "./flow_node_handler";
import { INodeDefEntity, IProcessTokenEntity } from "@process-engine/process_engine_contracts";
import { NextFlowNodeInfo } from "..";
import { ExecutionContext, IToPojoOptions } from "@essential-projects/core_contracts";

export class ScriptTaskHandler extends FlowNodeHandler {
    
    protected async executeIntern(scriptTask: INodeDefEntity, processToken: IProcessTokenEntity, context: ExecutionContext): Promise<void> {
        const tokenData = processToken.data || {};
        let result;
        const script = scriptTask.script;

        if (script) {
            try {
                const scriptFunction = new Function('token', 'context', script);
                result = await scriptFunction.call(this, tokenData, context);
            } catch (err) {
                result = err;
                //this.error(context, err);
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
        }
    }
}