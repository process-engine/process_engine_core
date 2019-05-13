import {Logger} from 'loggerhythm';
import * as uuid from 'node-uuid';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  TerminateEndEventReachedMessage,
  eventAggregatorSettings,
  onInterruptionCallback,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

export abstract class FlowNodeHandler<TFlowNode extends Model.Base.FlowNode> implements IFlowNodeHandler<TFlowNode> {

  protected flowNodeInstanceId: string = undefined;
  protected flowNode: TFlowNode;
  protected previousFlowNodeInstanceId: string;
  protected terminationSubscription: Subscription;

  protected logger: Logger;

  protected eventAggregator: IEventAggregator;
  protected flowNodeHandlerFactory: IFlowNodeHandlerFactory;
  protected flowNodePersistenceFacade: IFlowNodePersistenceFacade;

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    flowNode: TFlowNode,
  ) {
    this.eventAggregator = eventAggregator;
    this.flowNodeHandlerFactory = flowNodeHandlerFactory;
    this.flowNodePersistenceFacade = flowNodePersistenceFacade;
    this.flowNode = flowNode;
    this.flowNodeInstanceId = uuid.v4();
  }

  // eslint-disable-next-line @typescript-eslint/member-naming
  private _onInterruptedCallback: onInterruptionCallback = (): void => {};

  /**
   * Gets the callback that gets called when an interrupt-command was received.
   * This can be used by the derived handlers to perform handler-specific actions
   * necessary for stopping its work cleanly.
   *
   * Interruptions are currently done, when a TerminateEndEvent was reached, or
   * an interrupting BoundaryEvent was triggered.
   */
  protected get onInterruptedCallback(): onInterruptionCallback {
    return this._onInterruptedCallback;
  }

  /**
   * Sets the callback that gets called when an interrupt-command was received.
   */
  protected set onInterruptedCallback(value: onInterruptionCallback) {
    this._onInterruptedCallback = value;
  }

  public getInstanceId(): string {
    return this.flowNodeInstanceId;
  }

  public getFlowNode(): TFlowNode {
    return this.flowNode;
  }

  public abstract async execute(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    previousFlowNodeInstanceId?: string,
  ): Promise<void>;

  public abstract async resume(
    flowNodeInstances: Array<FlowNodeInstance>,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void>;

  /**
   * Allows each handler to perform custom preprations prior to execution.
   *
   * @async
   * @param token              The current ProcessToken.
   * @param processTokenFacade The ProcessTokenFacade of the currently
   *                           running process.
   * @param processModelFacade The ProcessModelFacade of the currently
   *                           running process.
   */
  protected async beforeExecute(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {
    return Promise.resolve();
  }

  /**
   * This is the method where the derived handlers must implement their logic
   * for executing new FlowNodeInstances.
   *
   * Here, the actual execution of the FlowNodes takes place.
   *
   * @async
   * @param   token              The current ProcessToken.
   * @param   processTokenFacade The ProcessTokenFacade of the currently
   *                             running process.
   * @param   processModelFacade The ProcessModelFacade of the currently
   *                             running process.
   * @param   identity           The requesting users identity.
   * @returns                    The FlowNode that follows after this one.
   */
  protected async abstract executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>>;

  /**
   * Handles the resumption of FlowNodeInstances.
   *
   * @async
   * @param   flowNodeInstance         The current ProcessToken.
   * @param   processTokenFacade       The ProcessTokenFacade of the currently
   *                                   running process.
   * @param   processModelFacade       The ProcessModelFacade of the currently
   *                                   running process.
   * @param   identity                 The identity of the user that originally
   *                                   started the ProcessInstance.
   * @param   processFlowNodeInstances Optional: The Process' FlowNodeInstances.
   *                                   BoundaryEvents require these.
   * @returns                          The FlowNode that follows after this one.
   */
  protected abstract async resumeInternally(
    flowNodeInstance: FlowNodeInstance,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    processFlowNodeInstances?: Array<FlowNodeInstance>,
  ): Promise<Array<Model.Base.FlowNode>>;

  /**
   * Allows each handler to perform custom cleanup operations after execution.
   *
   * @async
   * @param token              The current ProcessToken.
   * @param processTokenFacade The ProcessTokenFacade of the currently
   *                           running process.
   * @param processModelFacade The ProcessModelFacade of the currently
   *                           running process.
   */
  protected async afterExecute(
    token?: ProcessToken,
    processTokenFacade?: IProcessTokenFacade,
    processModelFacade?: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<void> {
    if (this.terminationSubscription) {
      this.eventAggregator.unsubscribe(this.terminationSubscription);
    }
  }

  /**
   * Resumes the given FlowNodeInstance from the point its execution was
   * first started.
   *
   * @async
   * @param   onEnterToken       The token the FlowNodeInstance had when it was
   *                             started.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @param   identity           The identity of the user that originally
   *                             started the ProcessInstance.
   * @returns                    The Info for the next FlowNode to run.
   */
  protected async continueAfterEnter(
    onEnterToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    return this.executeHandler(onEnterToken, processTokenFacade, processModelFacade, identity);
  }

  /**
   * Resumes the given FlowNodeInstance from the point it has finished execution.
   * This is used to reconstruct Token Histories.
   *
   * @async
   * @param   resumeToken        The ProcessToken stored after resuming the
   *                             FlowNodeInstance.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @param   identity           The identity of the user that originally
   *                             started the ProcessInstance.
   * @returns                    The Info for the next FlowNode to run.
   */
  protected async continueAfterExit(
    onExitToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, onExitToken.payload);

    return processModelFacade.getNextFlowNodesFor(this.flowNode);
  }

  /**
   * Contains all common logic for executing and resuming FlowNodeHandlers.
   *
   * @async
   * @param   token              The FlowNodeInstances current ProcessToken.
   * @param   processTokenFacade The ProcessTokenFacade to use.
   * @param   processModelFacade The processModelFacade to use.
   * @param   identity           The requesting users identity.
   * @returns                    Info about the next FlowNode to run.
   */
  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    return processModelFacade.getNextFlowNodesFor(this.flowNode);
  }

  protected subscribeToProcessTermination(token: ProcessToken, rejectionFunction: Function): Subscription {

    const terminateEvent = eventAggregatorSettings.messagePaths.processInstanceWithIdTerminated
      .replace(eventAggregatorSettings.messageParams.processInstanceId, token.processInstanceId);

    const onTerminatedCallback = async (message: TerminateEndEventReachedMessage): Promise<void> => {
      const payloadIsDefined = message !== undefined;

      token.payload = payloadIsDefined
        ? message.currentToken
        : {};

      await this.onInterruptedCallback(token);
      await this.afterExecute(token);

      await this.persistOnTerminate(token);

      const processTerminatedError = payloadIsDefined
        ? `Process was terminated through TerminateEndEvent '${message.flowNodeId}'!`
        : 'Process was terminated!';

      this.logger.error(processTerminatedError);

      const terminationError = new InternalServerError(processTerminatedError);

      return rejectionFunction(terminationError);
    };

    return this.eventAggregator.subscribeOnce(terminateEvent, onTerminatedCallback);
  }

  protected async persistOnEnter(processToken: ProcessToken): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnEnter(this.flowNode, this.flowNodeInstanceId, processToken, this.previousFlowNodeInstanceId);
  }

  protected async persistOnExit(processToken: ProcessToken): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnExit(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected async persistOnTerminate(processToken: ProcessToken): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnTerminate(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected async persistOnError(processToken: ProcessToken, error: Error): Promise<void> {
    await this.flowNodePersistenceFacade.persistOnError(this.flowNode, this.flowNodeInstanceId, processToken, error);
  }

}
