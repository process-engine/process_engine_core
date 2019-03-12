import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';

import {EventReceivedCallback, IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  eventAggregatorSettings,
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceResult,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {FlowNodeHandler} from '../index';

export class ParallelJoinGatewayHandler extends FlowNodeHandler<Model.Gateways.ParallelGateway> {

  private readonly _container: IContainer;

  private expectedNumberOfResults: number = -1;
  private receivedResults: Array<IFlowNodeInstanceResult> = [];

  private onEnterStatePersisted: boolean = false;
  private isInterrupted: boolean = false;

  private _processTerminationSubscription: Subscription;

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
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {

    const expectedResultsAlreadySet: boolean = this.expectedNumberOfResults > -1;

    // Safety check to prevent a handler to be resolved and called after it was already finished.
    const handlerIsAlreadyFinished: boolean = expectedResultsAlreadySet || this.isInterrupted;
    if (handlerIsAlreadyFinished) {
      return;
    }

    await super.beforeExecute(token, processTokenFacade, processModelFacade, identity);

    const subscriptionForProcessTerminationNeeded: boolean = !this._processTerminationSubscription;
    if (subscriptionForProcessTerminationNeeded) {
      this._subscribeToProcessTermination(token);
    }

    const preceedingFlowNodes: Array<Model.Base.FlowNode> = processModelFacade.getPreviousFlowNodesFor(this.parallelGateway);
    this.expectedNumberOfResults = preceedingFlowNodes.length;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    if (this.isInterrupted) {
      return;
    }

    // We must only store this state change once to prevent duplicate database entries.
    if (!this.onEnterStatePersisted) {
      this.onEnterStatePersisted = true;
      await this.persistOnEnter(token);
    }

    this.logger.verbose(`Executing ParallelJoinGateway instance ${this.flowNodeInstanceId}.`);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const latestResult: IFlowNodeInstanceResult = this._getLatestFlowNodeResultFromFacade(processTokenFacade);
    this.receivedResults.push(latestResult);

    const notAllBranchesHaveFinished: boolean = this.receivedResults.length < this.expectedNumberOfResults;
    if (notAllBranchesHaveFinished) {
      return undefined;
    }

    const aggregatedResults: any = this._aggregateResults();

    token.payload = aggregatedResults;

    processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, aggregatedResults);
    await this.persistOnExit(token);

    this._removeInstanceFromIocContainer(token);

    return processModelFacade.getNextFlowNodesFor(this.flowNode);
  }

  private _getLatestFlowNodeResultFromFacade(processTokenFacade: IProcessTokenFacade): IFlowNodeInstanceResult {
    return processTokenFacade.getAllResults().pop();
  }

  private _aggregateResults(): any {
    const resultToken: any = {};

    for (const branchResult of this.receivedResults) {
      resultToken[branchResult.flowNodeId] = branchResult.result;
    }

    return resultToken;
  }

  private _subscribeToProcessTermination(token: ProcessToken): void {

    const terminateEvent: string = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const onTerminatedCallback: EventReceivedCallback = async(message: TerminateEndEventReachedMessage): Promise<void> => {
      // This is done to prevent anybody from accessing the handler after a termination message was received.
      // This is necessary, to prevent access until the the state change to "terminated" is done.
      this.isInterrupted = true;

      const payloadIsDefined: boolean = message !== undefined;

      const processTerminatedError: string = payloadIsDefined
                                           ? `Process was terminated through TerminateEndEvent '${message.flowNodeId}'!`
                                           : 'Process was terminated!';

      token.payload = payloadIsDefined
                    ? message.currentToken
                    : {};

      this.logger.error(processTerminatedError);

      await this.persistOnTerminate(token);

      this._removeInstanceFromIocContainer(token);
    };

    this._processTerminationSubscription = this.eventAggregator.subscribeOnce(terminateEvent, onTerminatedCallback);
  }

  private _removeInstanceFromIocContainer(processToken: ProcessToken): void {

    const joinGatewayRegistration: string =
      `ParallelJoinGatewayHandlerInstance-${processToken.correlationId}-${processToken.processInstanceId}-${this.parallelGateway.id}`;

    this._container.unregister(joinGatewayRegistration);
  }
}
