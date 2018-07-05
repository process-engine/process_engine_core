import {IToPojoOptions} from '@essential-projects/core_contracts';
import {
  ExecutionContext,
  IExecutionContextFacade,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class ScriptTaskHandler extends FlowNodeHandler<Model.Activities.ScriptTask> {

  private _flowNodeInstancePersistenceService: IFlowNodeInstanceService = undefined;

  constructor(flowNodeInstancePersistenceService: IFlowNodeInstanceService) {
    super();
    this._flowNodeInstancePersistenceService = flowNodeInstancePersistenceService;
  }

  private get flowNodeInstancePersistenceService(): IFlowNodeInstanceService {
    return this._flowNodeInstancePersistenceService;
  }

  protected async executeInternally(scriptTask: Model.Activities.ScriptTask,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();

    await this.flowNodeInstancePersistenceService.persistOnEnter(executionContextFacade, token, scriptTask.id, flowNodeInstanceId);

    const script: string = scriptTask.script;
    const context: ExecutionContext = executionContextFacade.getExecutionContext();

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

    const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(scriptTask);

    await processTokenFacade.addResultForFlowNode(scriptTask.id, finalResult);
    token.payload = finalResult;

    await this.flowNodeInstancePersistenceService.persistOnExit(executionContextFacade, token, scriptTask.id, flowNodeInstanceId);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }
}
