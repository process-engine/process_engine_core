import {
  IExecutionContextFacade,
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

import {IEventAggregator, ISubscription} from '@essential-projects/event_aggregator_contracts';

import {FlowNodeHandler} from './index';
import {InternalServerError} from '@essential-projects/errors_ts';

export class ParallelGatewayHandler extends FlowNodeHandler<Model.Gateways.ParallelGateway> {

  private _eventAggregator: IEventAggregator = undefined;
  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory = undefined;
  private _flowNodeInstanceService: IFlowNodeInstanceService = undefined;

  private _processWasTerminated: boolean = false;
  private _processTerminationMessage: TerminateEndEventReachedMessage = undefined;

  constructor(eventAggregator: IEventAggregator, flowNodeHandlerFactory: IFlowNodeHandlerFactory, flowNodeInstanceService: IFlowNodeInstanceService) {
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

  protected async executeInternally(flowNode: Model.Gateways.ParallelGateway,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    await this.flowNodeInstanceService.persistOnEnter(executionContextFacade, token, flowNode.id, this.flowNodeInstanceId);

    const incomingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getIncomingSequenceFlowsFor(flowNode.id);
    const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getOutgoingSequenceFlowsFor(flowNode.id);

    const isSplitGateway: boolean = incomingSequenceFlows.length < outgoingSequenceFlows.length;

    if (isSplitGateway) {

      const processTerminationSubscription: ISubscription = this._createProcessTerminationSubscription(token.processInstanceId);

      // first find the ParallelGateway that joins the branch back to the original branch
      const joinGateway: Model.Gateways.ParallelGateway = processModelFacade.getJoinGatewayFor(flowNode);

      // all parallel branches are only executed until the join gateway is reached
      const parallelBranchExecutionPromises: Array<Promise<NextFlowNodeInfo>> =
        this._executeParallelBranches(outgoingSequenceFlows, joinGateway, token, processTokenFacade, processModelFacade, executionContextFacade);

      // After all parallel branches have been executed, each result is merged on the ProcessTokenFacade
      const nextFlowNodeInfos: Array<NextFlowNodeInfo> = await Promise.all(parallelBranchExecutionPromises);

      for (const nextFlowNodeInfo of nextFlowNodeInfos) {
        processTokenFacade.mergeTokenHistory(nextFlowNodeInfo.processTokenFacade);
      }

      const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(joinGateway);

      if (processTerminationSubscription) {
        processTerminationSubscription.dispose();
      }

      if (this._processWasTerminated) {
        await this.flowNodeInstanceService.persistOnTerminate(executionContextFacade, token, flowNode.id, this.flowNodeInstanceId);

        return new NextFlowNodeInfo(undefined, token, processTokenFacade);
      }

      await this.flowNodeInstanceService.persistOnExit(executionContextFacade, token, flowNode.id, this.flowNodeInstanceId);

      return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
    } else {
      return undefined;
    }
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

  private _executeParallelBranches(outgoingSequenceFlows: Array<Model.Types.SequenceFlow>,
                                   joinGateway: Model.Gateways.ParallelGateway,
                                   token: Runtime.Types.ProcessToken,
                                   processTokenFacade: IProcessTokenFacade,
                                   processModelFacade: IProcessModelFacade,
                                   executionContextFacade: IExecutionContextFacade): Array<Promise<NextFlowNodeInfo>> {

    return outgoingSequenceFlows.map(async(outgoingSequenceFlow: Model.Types.SequenceFlow): Promise<NextFlowNodeInfo> => {

      // To have an isolated ProcessToken for each branch, we fork a new ProcessToken from the original one and use it during execution of this branch
      const processTokenForBranch: IProcessTokenFacade = await processTokenFacade.getProcessTokenFacadeForParallelBranch();
      const tokenForBranch: Runtime.Types.ProcessToken = processTokenFacade.createProcessToken(token.payload);

      const nextFlowNodeInBranch: Model.Base.FlowNode = processModelFacade.getFlowNodeById(outgoingSequenceFlow.targetRef);

      return await this._executeBranchToJoinGateway(nextFlowNodeInBranch,
                                                    joinGateway,
                                                    tokenForBranch,
                                                    processTokenForBranch,
                                                    processModelFacade,
                                                    executionContextFacade);
    });
  }

  private async _executeBranchToJoinGateway(flowNode: Model.Base.FlowNode,
                                            joinGateway: Model.Gateways.ParallelGateway,
                                            token: Runtime.Types.ProcessToken,
                                            processTokenFacade: IProcessTokenFacade,
                                            processModelFacade: IProcessModelFacade,
                                            executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> = await this.flowNodeHandlerFactory.create(flowNode, processModelFacade);

    const nextFlowNodeInfo: NextFlowNodeInfo =
      await flowNodeHandler.execute(flowNode, token, processTokenFacade, processModelFacade, executionContextFacade);

    if (this._processWasTerminated) {
      await this.flowNodeInstanceService.persistOnTerminate(executionContextFacade, token, flowNode.id, flowNodeHandler.flowNodeInstanceId);
      throw new InternalServerError(`Process was terminated through TerminateEndEvent "${this._processTerminationMessage.eventId}".`);
    }

    const continueExecution: boolean =
      nextFlowNodeInfo.flowNode !== null && nextFlowNodeInfo.flowNode && nextFlowNodeInfo.flowNode.id !== joinGateway.id;
    if (continueExecution) {
      return this._executeBranchToJoinGateway(nextFlowNodeInfo.flowNode,
                                              joinGateway,
                                              nextFlowNodeInfo.token,
                                              nextFlowNodeInfo.processTokenFacade,
                                              processModelFacade,
                                              executionContextFacade);
    }

    return new NextFlowNodeInfo(joinGateway, nextFlowNodeInfo.token, nextFlowNodeInfo.processTokenFacade);
  }

}
