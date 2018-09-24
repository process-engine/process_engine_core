import {IIdentity} from '@essential-projects/iam_contracts';

import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';

import {FlowNodeHandler} from './index';

export class SubProcessHandler extends FlowNodeHandler<Model.Activities.SubProcess> {

  private _eventAggregator: IEventAggregator;
  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory;

  private _processWasTerminated: boolean = false;
  private _processTerminationMessage: TerminateEndEventReachedMessage;

  constructor(eventAggregator: IEventAggregator,
              flowNodeHandlerFactory: IFlowNodeHandlerFactory,
              flowNodeInstanceService: IFlowNodeInstanceService,
              metricsService: IMetricsApi) {
    super(flowNodeInstanceService, metricsService);
    this._eventAggregator = eventAggregator;
    this._flowNodeHandlerFactory = flowNodeHandlerFactory;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get flowNodeHandlerFactory(): IFlowNodeHandlerFactory {
    return this._flowNodeHandlerFactory;
  }

  protected async executeInternally(subProcess: Model.Activities.SubProcess,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(subProcess, token);

    const processTerminationSubscription: ISubscription = this._createProcessTerminationSubscription(token.processInstanceId);

    // Create a child Facade for the ProcessToken, so that results of the Process are accessible by the SubProcess,
    // but results of the SubProcess are not accessible by the original Process before the SubProcess finishes.

    const subProcessTokenFacade: IProcessTokenFacade = await processTokenFacade.getProcessTokenFacadeForParallelBranch();

    // The regular ProcessModelFacade has a too broad scope of elements to query elements that only exist inside a SubProcess.
    // However, the SubProcess contains all its FlowNodes and SequencesFlows so that we can use that object to query against.

    // The SubProcess-specific Facade implements the same interface as the regular ProcessModelFacade so that we can pass it
    // through to handlers inside the SubProcess.

    const subProcessModelFacade: IProcessModelFacade = processModelFacade.getSubProcessModelFacade(subProcess);
    const startEvents: Array<Model.Events.StartEvent> = subProcessModelFacade.getStartEvents();
    const startEvent: Model.Events.StartEvent = startEvents[0];

    // The initial token value is used as a result of the StartEvent inside the SubProcess
    const initialTokenData: any = await processTokenFacade.getOldTokenFormat();
    subProcessTokenFacade.addResultForFlowNode(startEvent.id, initialTokenData.current);

    await this._executeFlowNode(startEvent, token, subProcessTokenFacade, subProcessModelFacade, identity);

    const processTerminationSubscriptionIsActive: boolean = processTerminationSubscription !== undefined;
    if (processTerminationSubscriptionIsActive) {
      processTerminationSubscription.dispose();
    }

    // After all FlowNodes in the SubProcess have been executed, set the last "current" token value as a result of the whole SubProcess
    // and on the original ProcessTokenFacade, so that is is accessible by the original Process
    const finalTokenData: any = await subProcessTokenFacade.getOldTokenFormat();

    const nextFlowNode: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(subProcess);

    const finalResult: any = finalTokenData.current === undefined ? null : finalTokenData.current;

    processTokenFacade.addResultForFlowNode(subProcess.id, finalResult);
    token.payload = finalResult;

    await this.persistOnExit(subProcess, token);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }

  private _createProcessTerminationSubscription(processInstanceId: string): ISubscription {

    // Branch execution must not continue, if the process was terminated.
    // So we need to watch out for a terminate end event here aswell.
    const eventName: string = `/processengine/process/${processInstanceId}/terminated`;

    return this
        .eventAggregator
        .subscribeOnce(eventName, async(message: TerminateEndEventReachedMessage): Promise<void> => {
          this._processWasTerminated = true;
          this._processTerminationMessage = message;
      });
  }

  private async _executeFlowNode(flowNode: Model.Base.FlowNode,
                                 token: Runtime.Types.ProcessToken,
                                 processTokenFacade: IProcessTokenFacade,
                                 processModelFacade: IProcessModelFacade,
                                 identity: IIdentity): Promise<void> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo =
      await flowNodeHandler.execute(flowNode, token, processTokenFacade, processModelFacade, identity);

    if (this._processWasTerminated) {
      await this.flowNodeInstanceService.persistOnTerminate(flowNode.id, this.flowNodeInstanceId, token);
      throw new InternalServerError(`Process was terminated through TerminateEndEvent "${this._processTerminationMessage.eventId}".`);
    }

    if (nextFlowNodeInfo.flowNode !== undefined) {
      await this._executeFlowNode(nextFlowNodeInfo.flowNode,
                                  nextFlowNodeInfo.token,
                                  nextFlowNodeInfo.processTokenFacade,
                                  processModelFacade,
                                  identity);
    }
  }

}
