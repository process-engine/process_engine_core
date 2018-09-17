import {
  eventAggregatorSettings,
  IExecutionContextFacade,
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  ProcessEndedMessage,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';

import {FlowNodeHandler} from './index';

interface IProcessStateInfo {
  processTerminationSubscription?: ISubscription;
  processTerminatedMessage?: ProcessEndedMessage;
}

export class SubProcessHandler extends FlowNodeHandler<Model.Activities.SubProcess> {

  private _eventAggregator: IEventAggregator = undefined;
  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory = undefined;
  private _flowNodeInstanceService: IFlowNodeInstanceService = undefined;

  constructor(eventAggregator: IEventAggregator,
              flowNodeHandlerFactory: IFlowNodeHandlerFactory,
              flowNodeInstanceService: IFlowNodeInstanceService) {
    super();
    this._eventAggregator = eventAggregator;
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
    this._flowNodeInstanceService = flowNodeInstanceService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get flowNodeHandlerFactory(): IFlowNodeHandlerFactory {
    return this._flowNodeHandlerFactory;
  }

  private get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
  }

  protected async executeInternally(subProcessNode: Model.Activities.SubProcess,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    await this.flowNodeInstanceService.persistOnEnter(subProcessNode.id, this.flowNodeInstanceId, token);

    const processStateInfo: IProcessStateInfo = {};

    const processTerminatedEvent: string = eventAggregatorSettings.routePaths.processTerminated
      .replace(eventAggregatorSettings.routeParams.processInstanceId, token.processInstanceId);

    const processTerminationSubscription: ISubscription = this.eventAggregator
      .subscribeOnce(processTerminatedEvent, async(message: ProcessEndedMessage): Promise<void> => {
        processStateInfo.processTerminatedMessage = message;
      });

    // Create a child Facade for the ProcessToken, so that results of the Process are accessible by the SubProcess,
    // but results of the SubProcess are not accessible by the original Process before the SubProcess finishes.

    const subProcessTokenFacade: IProcessTokenFacade = await processTokenFacade.getProcessTokenFacadeForParallelBranch();

    // The regular ProcessModelFacade has a too broad scope of elements to query elements that only exist inside a SubProcess.
    // However, the SubProcess contains all its FlowNodes and SequencesFlows so that we can use that object to query against.

    // The SubProcess-specific Facade implements the same interface as the regular ProcessModelFacade so that we can pass it
    // through to handlers inside the SubProcess.

    const subProcessModelFacade: IProcessModelFacade = processModelFacade.getSubProcessModelFacade(subProcessNode);
    const startEvents: Array<Model.Events.StartEvent> = subProcessModelFacade.getStartEvents();
    const startEvent: Model.Events.StartEvent = startEvents[0];

    // The initial token value is used as a result of the StartEvent inside the SubProcess
    const initialTokenData: any = await processTokenFacade.getOldTokenFormat();
    subProcessTokenFacade.addResultForFlowNode(startEvent.id, initialTokenData.current);

    await this._executeFlowNode(startEvent,
                                token,
                                subProcessTokenFacade,
                                subProcessModelFacade,
                                executionContextFacade,
                                processStateInfo);

    const processTerminationSubscriptionIsActive: boolean = processTerminationSubscription !== undefined;
    if (processTerminationSubscriptionIsActive) {
      processTerminationSubscription.dispose();
    }

    // After all FlowNodes in the SubProcess have been executed, set the last "current" token value as a result of the whole SubProcess
    // and on the original ProcessTokenFacade, so that is is accessible by the original Process
    const finalTokenData: any = await subProcessTokenFacade.getOldTokenFormat();

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(subProcessNode);

    const finalResult: any = finalTokenData.current === undefined ? null : finalTokenData.current;

    processTokenFacade.addResultForFlowNode(subProcessNode.id, finalResult);
    token.payload = finalResult;

    await this.flowNodeInstanceService.persistOnExit(subProcessNode.id, this.flowNodeInstanceId, token);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }

  private async _executeFlowNode(flowNode: Model.Base.FlowNode,
                                 token: Runtime.Types.ProcessToken,
                                 processTokenFacade: IProcessTokenFacade,
                                 processModelFacade: IProcessModelFacade,
                                 executionContextFacade: IExecutionContextFacade,
                                 processStateInfo: IProcessStateInfo): Promise<void> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo =
      await flowNodeHandler.execute(flowNode, token, processTokenFacade, processModelFacade, executionContextFacade);

    const processWasTerminated: boolean = processStateInfo.processTerminatedMessage !== undefined;

    if (processWasTerminated) {
        await this.flowNodeInstanceService.persistOnTerminate(flowNode.id, this.flowNodeInstanceId, token);
        throw new InternalServerError(`Process was terminated through TerminateEndEvent "${processStateInfo.processTerminatedMessage.flowNodeId}".`);
      }

    if (nextFlowNodeInfo.flowNode !== undefined) {
      await this._executeFlowNode(nextFlowNodeInfo.flowNode,
                                  nextFlowNodeInfo.token,
                                  nextFlowNodeInfo.processTokenFacade,
                                  processModelFacade,
                                  executionContextFacade,
                                  processStateInfo);
    }
  }

}
