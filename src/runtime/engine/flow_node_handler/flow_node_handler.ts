import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';
import * as uuid from 'node-uuid';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  IFlowNodeHandler,
  IFlowNodeHandlerFactory,
  IFlowNodeInstanceService,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  IProcessTokenResult,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

export abstract class FlowNodeHandler<TFlowNode extends Model.Base.FlowNode> implements IFlowNodeHandler<TFlowNode> {

  protected _flowNodeInstanceId: string = undefined;
  protected _flowNode: TFlowNode;
  protected _previousFlowNodeInstanceId: string;

  protected logger: Logger;

  protected readonly _container: IContainer;

  private _eventAggregator: IEventAggregator;
  private _flowNodeHandlerFactory: IFlowNodeHandlerFactory;
  private _flowNodeInstanceService: IFlowNodeInstanceService;
  private _flowNodePersistenceFacade: IFlowNodePersistenceFacade;
  private _loggingApiService: ILoggingApi;
  private _metricsApiService: IMetricsApi;

  constructor(container: IContainer, flowNode: TFlowNode) {
    this._container = container;
    this._flowNode = flowNode;
    this._flowNodeInstanceId = uuid.v4();
  }

  protected get flowNodeInstanceId(): string {
    return this._flowNodeInstanceId;
  }

  protected get flowNode(): TFlowNode {
    return this._flowNode;
  }

  protected get previousFlowNodeInstanceId(): string {
    return this._previousFlowNodeInstanceId;
  }

  protected get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  protected get flowNodeHandlerFactory(): IFlowNodeHandlerFactory {
    return this._flowNodeHandlerFactory;
  }

  protected get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
  }

  protected get flowNodePersistenceFacade(): IFlowNodePersistenceFacade {
    return this._flowNodePersistenceFacade;
  }

  protected get loggingApiService(): ILoggingApi {
    return this._loggingApiService;
  }

  protected get metricsApiService(): IMetricsApi {
    return this._metricsApiService;
  }

  public async initialize(): Promise<void> {
    this._eventAggregator = await this._container.resolveAsync<IEventAggregator>('EventAggregator');
    this._flowNodeHandlerFactory = await this._container.resolveAsync<IFlowNodeHandlerFactory>('FlowNodeHandlerFactory');
    this._flowNodeInstanceService = await this._container.resolveAsync<IFlowNodeInstanceService>('FlowNodeInstanceService');
    this._flowNodePersistenceFacade = await this._container.resolveAsync<IFlowNodePersistenceFacade>('FlowNodePersistenceFacade');
    this._loggingApiService = await this._container.resolveAsync<ILoggingApi>('LoggingApiService');
    this._metricsApiService = await this._container.resolveAsync<IMetricsApi>('MetricsApiService');
  }

  public async execute(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    previousFlowNodeInstanceId?: string,
  ): Promise<void> {

    try {
      this._previousFlowNodeInstanceId = previousFlowNodeInstanceId;
      token.flowNodeInstanceId = this.flowNodeInstanceId;
      let nextFlowNodes: Array<Model.Base.FlowNode>;

      await this.beforeExecute(token, processTokenFacade, processModelFacade);
      nextFlowNodes = await this.executeInternally(token, processTokenFacade, processModelFacade, identity);
      await this.afterExecute(token, processTokenFacade, processModelFacade);

      // EndEvents will return "undefined" as the next FlowNode.
      // So if no FlowNode is to be run next, we have arrived at the end of the ProcessInstance.
      const processIsNotYetFinished: boolean = nextFlowNodes && nextFlowNodes.length > 0;
      if (processIsNotYetFinished) {

        await Promise.map<Model.Base.FlowNode, void>(nextFlowNodes, async(nextFlowNode: Model.Base.FlowNode): Promise<void> => {
          const nextFlowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> =
            await this.flowNodeHandlerFactory.create<Model.Base.FlowNode>(nextFlowNode, token);

          // If we must execute multiple branches, then each branch must get its own ProcessToken.
          const tokenForNextFlowNode: Runtime.Types.ProcessToken = nextFlowNodes.length > 1
            ? processTokenFacade.createProcessToken(token.payload)
            : token;

          tokenForNextFlowNode.flowNodeInstanceId = nextFlowNodeHandler.getInstanceId();

          return nextFlowNodeHandler.execute(tokenForNextFlowNode, processTokenFacade, processModelFacade, identity, this.flowNodeInstanceId);
        });
      }
    } catch (error) {
      processTokenFacade.addResultForFlowNode(this.flowNode.id, error);
      throw error;
    }
  }

  public async resume(
    flowNodeInstances: Array<Runtime.Types.FlowNodeInstance>,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {

    try {
      const flowNodeInstance: Runtime.Types.FlowNodeInstance =
        flowNodeInstances.find((instance: Runtime.Types.FlowNodeInstance) => instance.flowNodeId === this.flowNode.id);

      this._previousFlowNodeInstanceId = flowNodeInstance.previousFlowNodeInstanceId;
      this._flowNodeInstanceId = flowNodeInstance.id;

      // WIth regards to ParallelGateways, we need to be able to handle multiple results here.
      let nextFlowNodes: Array<Model.Base.FlowNode>;

      // It doesn't really matter which token is used here, since payload-specific operations should
      // only ever be done during the handlers execution.
      // We only require the token here, so that we can pass infos like ProcessInstanceId or CorrelationId to the hook.
      const tokenForHandlerHooks: Runtime.Types.ProcessToken = flowNodeInstance.tokens[0];

      await this.beforeExecute(tokenForHandlerHooks, processTokenFacade, processModelFacade);
      nextFlowNodes = await this.resumeInternally(flowNodeInstance, processTokenFacade, processModelFacade, identity, flowNodeInstances);
      await this.afterExecute(tokenForHandlerHooks, processTokenFacade, processModelFacade);

      // EndEvents will return "undefined" as the next FlowNode.
      // So if no FlowNode is returned, we have arrived at the end of the ProcessInstance.
      const processIsNotYetFinished: boolean = nextFlowNodes && nextFlowNodes.length > 0;
      if (processIsNotYetFinished) {

        // No instance for the next FlowNode was found.
        // We have arrived at the point at which the ProcessInstance was interrupted and can continue normally.
        const currentResult: IProcessTokenResult = processTokenFacade
          .getAllResults()
          .pop();

        await Promise.map<Model.Base.FlowNode, void>(nextFlowNodes, async(nextFlowNode: Model.Base.FlowNode): Promise<void> => {

          const processToken: Runtime.Types.ProcessToken = processTokenFacade.createProcessToken(currentResult.result);

          const nextFlowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> =
            await this.flowNodeHandlerFactory.create<Model.Base.FlowNode>(nextFlowNode, processToken);

          const nextFlowNodeInstance: Runtime.Types.FlowNodeInstance =
            flowNodeInstances.find((instance: Runtime.Types.FlowNodeInstance) => instance.flowNodeId === nextFlowNode.id);

          processToken.flowNodeInstanceId = nextFlowNodeInstance
            ? nextFlowNodeInstance.id
            : nextFlowNodeHandler.getInstanceId();

          // An instance for the next FlowNode has already been created. Continue resuming
          if (nextFlowNodeInstance) {
            return nextFlowNodeHandler.resume(flowNodeInstances, processTokenFacade, processModelFacade, identity);
          }

          return nextFlowNodeHandler.execute(processToken, processTokenFacade, processModelFacade, identity, this.flowNodeInstanceId);
        });
      }
    } catch (error) {
      processTokenFacade.addResultForFlowNode(this.flowNode.id, error);
      throw error;
    }
  }

  public getInstanceId(): string {
    return this.flowNodeInstanceId;
  }

  public getFlowNode(): TFlowNode {
    return this.flowNode;
  }

  /**
   * Allows each handler to perform custom preprations prior to being executed.
   * For example, creating subscriptions for specific events.
   *
   * @async
   * @param token              The current ProcessToken.
   * @param processTokenFacade The ProcessTokenFacade of the currently
   *                           running process.
   * @param processModelFacade The ProcessModelFacade of the currently
   *                           running process.
   */
  protected async beforeExecute(
    token?: Runtime.Types.ProcessToken,
    processTokenFacade?: IProcessTokenFacade,
    processModelFacade?: IProcessModelFacade,
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
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>>;

  /**
   * Allows each handler to perform custom cleanup operations.
   * For example, cleaning up EventAggregator Subscriptions.
   *
   * @async
   * @param token              The current ProcessToken.
   * @param processTokenFacade The ProcessTokenFacade of the currently
   *                           running process.
   * @param processModelFacade The ProcessModelFacade of the currently
   *                           running process.
   */
  protected async afterExecute(
    token?: Runtime.Types.ProcessToken,
    processTokenFacade?: IProcessTokenFacade,
    processModelFacade?: IProcessModelFacade,
  ): Promise<void> {
    return Promise.resolve();
  }

  /**
   * This is the method where the derived handlers must implement their logic
   * for resuming a previously interrupted instance.
   *
   * The base implementation comes with a logic for resuming after "onEnter",
   * "onExit" and all error cases.
   * Handlers that use suspension and resumption must override this function.
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
  protected async resumeInternally(
    flowNodeInstance: Runtime.Types.FlowNodeInstance,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    processFlowNodeInstances?: Array<Runtime.Types.FlowNodeInstance>,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Resuming FlowNodeInstance ${flowNodeInstance.id}.`);

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.suspended:
        this.logger.verbose(`FlowNodeInstance was left suspended. Waiting for the resuming event to happen.`);
        const suspendToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onSuspend);

        return this._continueAfterSuspend(flowNodeInstance, suspendToken, processTokenFacade, processModelFacade, identity);

      case Runtime.Types.FlowNodeInstanceState.running:
        const resumeToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onResume);

        const notSuspendedYet: boolean = resumeToken === undefined;
        if (notSuspendedYet) {
          this.logger.verbose(`FlowNodeInstance was interrupted at the beginning. Resuming from the start.`);
          const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onEnter);

          return this._continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade, identity);
        }

        this.logger.verbose(`The FlowNodeInstance was already suspended and resumed. Finishing up the handler.`);

        return this._continueAfterResume(resumeToken, processTokenFacade, processModelFacade);

      case Runtime.Types.FlowNodeInstanceState.finished:
        this.logger.verbose(`FlowNodeInstance was already finished. Skipping ahead.`);
        const onExitToken: Runtime.Types.ProcessToken = flowNodeInstance.getTokenByType(Runtime.Types.ProcessTokenType.onExit);

        return this._continueAfterExit(onExitToken, processTokenFacade, processModelFacade, identity);

      case Runtime.Types.FlowNodeInstanceState.error:
        this.logger.error(`Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because it previously exited with an error!`,
                     flowNodeInstance.error);
        throw flowNodeInstance.error;

      case Runtime.Types.FlowNodeInstanceState.terminated:
        const terminatedError: string = `Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because it was terminated!`;
        this.logger.error(terminatedError);
        throw new InternalServerError(terminatedError);

      default:
        const invalidStateError: string = `Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because its state cannot be determined!`;
        this.logger.error(invalidStateError);
        throw new InternalServerError(invalidStateError);
    }
  }

  /**
   * Resumes the given FlowNodeInstance from the point where it assumed the
   * "onEnter" state.
   *
   * Basically, the handler was not yet executed, except for the initial
   * state change.
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
  protected async _continueAfterEnter(
    onEnterToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    return this._executeHandler(onEnterToken, processTokenFacade, processModelFacade, identity);
  }

  /**
   * Resumes the given FlowNodeInstance from the point where it assumed the
   * "onSuspended" state.
   *
   * @async
   * @param   flowNodeInstance   The FlowNodeInstance to resume.
   * @param   onSuspendToken     The token the FlowNodeInstance had when it was
   *                             suspended.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @param   identity           The identity of the user that originally
   *                             started the ProcessInstance.
   * @returns                    The Info for the next FlowNode to run.
   */
  protected async _continueAfterSuspend(
    flowNodeInstance: Runtime.Types.FlowNodeInstance,
    onSuspendToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    processTokenFacade.addResultForFlowNode(this.flowNode.id, onSuspendToken.payload);
    await this.persistOnResume(onSuspendToken);
    await this.persistOnExit(onSuspendToken);

    return processModelFacade.getNextFlowNodesFor(this.flowNode);
  }

  /**
   * Resumes the given FlowNodeInstance from the point where it resumed activity,
   * after having been suspended.
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
  protected async _continueAfterResume(
    resumeToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    processTokenFacade.addResultForFlowNode(this.flowNode.id, resumeToken.payload);
    await this.persistOnExit(resumeToken);

    return processModelFacade.getNextFlowNodesFor(this.flowNode);
  }

  /**
   * Resumes the given FlowNodeInstance from the point where it assumed the
   * "onExit" state.
   *
   * Basically, the handler had already finished.
   * We just need to return the info about the next FlowNode to run.
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
  protected async _continueAfterExit(
    onExitToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    processTokenFacade.addResultForFlowNode(this.flowNode.id, onExitToken.payload);

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
  protected async _executeHandler(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity?: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    return processModelFacade.getNextFlowNodesFor(this.flowNode);
  }

  protected async persistOnEnter(processToken: Runtime.Types.ProcessToken): Promise<void> {
    await this._flowNodePersistenceFacade.persistOnEnter(this.flowNode, this.flowNodeInstanceId, processToken, this.previousFlowNodeInstanceId);
  }

  protected async persistOnExit(processToken: Runtime.Types.ProcessToken): Promise<void> {
    await this._flowNodePersistenceFacade.persistOnExit(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected async persistOnTerminate(processToken: Runtime.Types.ProcessToken): Promise<void> {
    await this._flowNodePersistenceFacade.persistOnTerminate(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected async persistOnError(processToken: Runtime.Types.ProcessToken, error: Error): Promise<void> {
    await this._flowNodePersistenceFacade.persistOnError(this.flowNode, this.flowNodeInstanceId, processToken, error);
  }

  protected async persistOnSuspend(processToken: Runtime.Types.ProcessToken): Promise<void> {
    await this._flowNodePersistenceFacade.persistOnSuspend(this.flowNode, this.flowNodeInstanceId, processToken);
  }

  protected async persistOnResume(processToken: Runtime.Types.ProcessToken): Promise<void> {
    await this._flowNodePersistenceFacade.persistOnResume(this.flowNode, this.flowNodeInstanceId, processToken);
  }
}
