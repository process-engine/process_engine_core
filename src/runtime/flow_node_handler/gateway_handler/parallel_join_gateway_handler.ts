import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {Model, ProcessToken} from '@process-engine/persistence_api.contracts';
import {
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceResult,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  ProcessErrorMessage,
  eventAggregatorSettings,
} from '@process-engine/process_engine_contracts';

import {GatewayHandler} from './index';

export class ParallelJoinGatewayHandler extends GatewayHandler<Model.Gateways.ParallelGateway> {

  private readonly container: IContainer;

  private incomingFlowNodeInstanceIds: Array<string> = [];
  private receivedResults: Array<IFlowNodeInstanceResult> = [];

  private isInterrupted = false;

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

    // TODO: Works for now, but there really must be a better solution for this problem.
    //
    // The base ID gets overwritten each time an incoming SequenceFlow arrives.
    // So with each execution of this hook, we get an additional ID of one of
    // the preceeding FlowNodeInstances.
    // Since we must store ALL previousFlowNodeInstanceIds for the gateway,
    // we'll add each ID to the `incomingFlowNodeInstanceIds`.
    // Each time a new ID is stored, `persistOnEnter` is called with the current amount of received IDs.
    // This ensures that the FlowNodeInstance for this gateway will always have the most up to date info
    // about which branches have arrived at the gateway.
    //
    // We must do it like this, or resuming the Join Gateway will have unpredictable results and will most
    // likely crash the ProcessInstance.
    this.incomingFlowNodeInstanceIds.push(this.previousFlowNodeInstanceId);

    if (!this.terminationSubscription) {
      this.terminationSubscription = this.subscribeToProcessTermination(token);
    }

    if (!this.processErrorSubscription) {
      this.processErrorSubscription = this.subscribeToProcessError(token);
    }
  }

  protected async afterExecute(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {
    return Promise.resolve();
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

    await this.persistOnEnter(token, this.incomingFlowNodeInstanceIds);

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

    const previousFlowNodes = processModelFacade.getPreviousFlowNodesFor(this.parallelGateway);

    const notAllBranchesHaveFinished = !previousFlowNodes.every((previousFlowNode): boolean => {
      return this.receivedResults.some((result): boolean => {
        return result.flowNodeId === previousFlowNode.id;
      });
    });

    if (notAllBranchesHaveFinished) {
      return undefined;
    }
    this.cleanupSubscriptions();
    this.removeInstanceFromIocContainer(token);

    const aggregatedResults = this.aggregateResults();

    token.payload = aggregatedResults;

    processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, aggregatedResults);
    await this.persistOnExit(token);

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

    const onTerminatedCallback = async (message): Promise<void> => {
      // This is done to prevent anybody from accessing the handler after a termination message was received.
      // This is necessary, to prevent access until the the state change to "terminated" is done.
      this.isInterrupted = true;
      this.cleanupSubscriptions();

      const terminatedByEndEvent = message?.flowNodeId != undefined;

      token.payload = terminatedByEndEvent
        ? message.currentToken
        : {};

      await this.persistOnTerminate(token);

      this.removeInstanceFromIocContainer(token);
    };

    return this.eventAggregator.subscribeOnce(terminateEvent, onTerminatedCallback);
  }

  protected subscribeToProcessError(token: ProcessToken): Subscription {

    const errorEvent = eventAggregatorSettings.messagePaths.processInstanceWithIdErrored
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const onErroredCallback = async (message: ProcessErrorMessage): Promise<void> => {
      // This is done to prevent anybody from accessing the handler after an error message was received.
      // This is necessary, to prevent access until the the state change to "error" is done.
      this.isInterrupted = true;
      this.cleanupSubscriptions();

      const payloadIsDefined = message != undefined;

      token.payload = payloadIsDefined
        ? message.currentToken
        : {};

      const error = new InternalServerError('ProcessInstance encountered an error!');
      error.additionalInformation = message.currentToken;

      await this.persistOnError(token, error);

      this.removeInstanceFromIocContainer(token);
    };

    return this.eventAggregator.subscribeOnce(errorEvent, onErroredCallback);
  }

  private cleanupSubscriptions(): void {
    this.eventAggregator.unsubscribe(this.processErrorSubscription);
    this.eventAggregator.unsubscribe(this.terminationSubscription);
  }

  private removeInstanceFromIocContainer(processToken: ProcessToken): void {

    const joinGatewayRegistration =
      `ParallelJoinGatewayHandlerInstance-${processToken.correlationId}-${processToken.processInstanceId}-${this.parallelGateway.id}`;

    this.container.unregister(joinGatewayRegistration);
  }

}
