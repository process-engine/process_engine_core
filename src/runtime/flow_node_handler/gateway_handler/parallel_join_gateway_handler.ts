import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';

import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceResult,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  TerminateEndEventReachedMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {GatewayHandler} from './index';

export class ParallelJoinGatewayHandler extends GatewayHandler<Model.Gateways.ParallelGateway> {

  private readonly container: IContainer;

  private expectedNumberOfResults: number = -1;
  private incomingFlowNodeInstanceIds: Array<string> = [];
  private receivedResults: Array<IFlowNodeInstanceResult> = [];

  private isInterrupted: boolean = false;

  private processTerminationSubscription: Subscription;

  constructor(
    container: IContainer,
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    parallelGatewayModel: Model.Gateways.ParallelGateway,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, parallelGatewayModel);
    this.container = container;
    this.logger = Logger.createLogger(`processengine:parallel_join_gateway:${parallelGatewayModel.id}`);
  }

  private get parallelGateway(): Model.Gateways.ParallelGateway {
    return this.flowNode;
  }

  protected async beforeExecute(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {

    // Safety check to prevent a handler to be resolved and called after it was already finished.
    if (this.isInterrupted) {
      return;
    }

    await super.beforeExecute(token, processTokenFacade, processModelFacade, identity);

    // TODO: Works for now, but there really must be a better solution for this problem.
    //
    // This ID gets overriden, each time an incoming SequenceFlow arrives.
    // So with each execution of this hook, we get an additional ID of one of
    // the preceeding FlowNodeInstances.
    // Since we must store ALL previousFlowNodeInstanceIds for the gateway,
    // we'll add each ID to the `incomingFlowNodeInstanceIds`.
    // When all Ids have been stored, the "persistOnEnter" gets all IDs as a concatenated string.
    // This way, we can be sure that the `previousFlowNodeInstanceId` database field has all the relevant IDs.
    //
    // We must do it like this, or resuming the Join Gateway will have unpredictable results and will most
    // likely crash the ProcessInstance.
    this.incomingFlowNodeInstanceIds.push(this.previousFlowNodeInstanceId);

    const subscriptionForProcessTerminationNeeded = !this.processTerminationSubscription;
    if (subscriptionForProcessTerminationNeeded) {
      this.processTerminationSubscription = this.subscribeToProcessTermination(token);
    }

    const expectedNumerOfResultsNotset = this.expectedNumberOfResults === -1;
    if (expectedNumerOfResultsNotset) {
      const preceedingFlowNodes = processModelFacade.getPreviousFlowNodesFor(this.parallelGateway);
      this.expectedNumberOfResults = preceedingFlowNodes.length;
    }
  }

  protected async startExecution(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    if (this.isInterrupted) {
      return undefined;
    }

    this.logger.verbose(`Executing ParallelJoinGateway instance ${this.flowNodeInstanceId}.`);

    const allPreviousFlowNodeInstanceIdsStored = this.incomingFlowNodeInstanceIds.length === this.expectedNumberOfResults;
    if (allPreviousFlowNodeInstanceIdsStored) {
      // We must only do the "onEnter" persistence, when we have ALL the IDs of the preceeding FlowNodeInstances.
      await this.persistOnEnter(token, this.incomingFlowNodeInstanceIds);
    }

    return this.executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const latestResult = this.getLatestFlowNodeResultFromFacade(processTokenFacade);
    this.receivedResults.push(latestResult);

    const notAllBranchesHaveFinished = this.receivedResults.length < this.expectedNumberOfResults;
    if (notAllBranchesHaveFinished) {
      return undefined;
    }

    const aggregatedResults = this.aggregateResults();

    token.payload = aggregatedResults;

    processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, aggregatedResults);
    await this.persistOnExit(token);

    this.removeInstanceFromIocContainer(token);

    return processModelFacade.getNextFlowNodesFor(this.flowNode);
  }

  private getLatestFlowNodeResultFromFacade(processTokenFacade: IProcessTokenFacade): IFlowNodeInstanceResult {
    return processTokenFacade.getAllResults().pop();
  }

  private aggregateResults(): any {
    const resultToken = {};

    for (const branchResult of this.receivedResults) {
      resultToken[branchResult.flowNodeId] = branchResult.result;
    }

    return resultToken;
  }

  protected subscribeToProcessTermination(token: ProcessToken): Subscription {

    const terminateEvent = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const onTerminatedCallback = async (message: TerminateEndEventReachedMessage): Promise<void> => {
      // This is done to prevent anybody from accessing the handler after a termination message was received.
      // This is necessary, to prevent access until the the state change to "terminated" is done.
      this.isInterrupted = true;

      const payloadIsDefined = message !== undefined;

      const processTerminatedError = payloadIsDefined
        ? `Process was terminated through TerminateEndEvent '${message.flowNodeId}'!`
        : 'Process was terminated!';

      token.payload = payloadIsDefined
        ? message.currentToken
        : {};

      this.logger.error(processTerminatedError);

      await this.persistOnTerminate(token);

      this.removeInstanceFromIocContainer(token);
    };

    return this.eventAggregator.subscribeOnce(terminateEvent, onTerminatedCallback);
  }

  private removeInstanceFromIocContainer(processToken: ProcessToken): void {

    const joinGatewayRegistration =
      `ParallelJoinGatewayHandlerInstance-${processToken.correlationId}-${processToken.processInstanceId}-${this.parallelGateway.id}`;

    this.container.unregister(joinGatewayRegistration);
  }

}
