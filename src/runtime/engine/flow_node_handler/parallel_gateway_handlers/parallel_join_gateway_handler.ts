import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';

import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  IProcessTokenResult,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandlerInterruptible} from '../index';

export class ParallelJoinGatewayHandler extends FlowNodeHandlerInterruptible<Model.Gateways.ParallelGateway> {

  private readonly _container: IContainer;

  private expectedNumberOfResults: number = -1;
  private receivedResults: Array<IProcessTokenResult> = [];

  private onEnterStatePersisted: boolean = false;

  constructor(
    container: IContainer,
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    parallelGatewayModel: Model.Gateways.ParallelGateway,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, parallelGatewayModel);
    this._container = container;
    this.logger = Logger.createLogger(`processengine:parallel_join_gateway:${parallelGatewayModel.id}`);
  }

  private get parallelGateway(): Model.Gateways.ParallelGateway {
    return super.flowNode;
  }

  protected async beforeExecute(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {

    await super.beforeExecute(token, processTokenFacade, processModelFacade, identity);

    const expectedResultsAlreadySet: boolean = this.expectedNumberOfResults > -1;
    if (expectedResultsAlreadySet) {
      return;
    }

    const preceedingFlowNodes: Array<Model.Base.FlowNode> = processModelFacade.getPreviousFlowNodesFor(this.parallelGateway);
    this.expectedNumberOfResults = preceedingFlowNodes.length;
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    // We must only store this state change once to prevent duplicate database entries.
    if (!this.onEnterStatePersisted) {
      this.onEnterStatePersisted = true;
      await this.persistOnEnter(token);
    }

    this.logger.verbose(`Executing ParallelJoinGateway instance ${this.flowNodeInstanceId}.`);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const latestResult: IProcessTokenResult = this._getLatestFlowNodeResultFromFacade(processTokenFacade);
    this.receivedResults.push(latestResult);

    const notAllBranchesHaveFinished: boolean = this.receivedResults.length < this.expectedNumberOfResults;
    if (notAllBranchesHaveFinished) {
      return undefined;
    }

    const aggregatedResults: any = this._aggregateResults();

    token.payload = aggregatedResults;

    await this.persistOnExit(token);
    processTokenFacade.addResultForFlowNode(this.flowNode.id, aggregatedResults);

    this._removeInstanceFromIocContainer(token);

    return processModelFacade.getNextFlowNodesFor(this.flowNode);
  }

  private _getLatestFlowNodeResultFromFacade(processTokenFacade: IProcessTokenFacade): IProcessTokenResult {
    return processTokenFacade.getAllResults().pop();
  }

  private _aggregateResults(): any {
    const resultToken: any = {};

    for (const branchResult of this.receivedResults) {
      resultToken[branchResult.flowNodeId] = branchResult.result;
    }

    return resultToken;
  }

  private _removeInstanceFromIocContainer(processToken: Runtime.Types.ProcessToken): void {

    const joinGatewayRegistration: string =
      `ParallelJoinGatewayHandlerInstance-${processToken.correlationId}-${processToken.processInstanceId}-${this.parallelGateway.id}`;

    this._container.unregister(joinGatewayRegistration);
  }
}
