import * as moment from 'moment';
import * as uuid from 'uuid';

import {IIdentity} from '@essential-projects/iam_contracts';
import {ILoggingApi, LogLevel} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  IFlowNodeHandler,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

export abstract class FlowNodeHandler<TFlowNode extends Model.Base.FlowNode> implements IFlowNodeHandler<TFlowNode> {

  protected _flowNodeInstanceId: string = undefined;
  protected _flowNode: TFlowNode;
  protected _previousFlowNodeInstanceId: string;

  private _flowNodeInstanceService: IFlowNodeInstanceService;
  private _loggingApiService: ILoggingApi;
  private _metricsApiService: IMetricsApi;

  constructor(flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsApiService: IMetricsApi,
              flowNode: TFlowNode) {
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._loggingApiService = loggingApiService;
    this._metricsApiService = metricsApiService;
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

  protected get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
  }

  protected get loggingApiService(): ILoggingApi {
    return this._loggingApiService;
  }

  protected get metricsApiService(): IMetricsApi {
    return this._metricsApiService;
  }

  public async execute(token: Runtime.Types.ProcessToken,
                       processTokenFacade: IProcessTokenFacade,
                       processModelFacade: IProcessModelFacade,
                       identity: IIdentity,
                       previousFlowNodeInstanceId?: string,
                      ): Promise<NextFlowNodeInfo> {

    this._previousFlowNodeInstanceId = previousFlowNodeInstanceId;
    token.flowNodeInstanceId = this.flowNodeInstanceId;
    let nextFlowNode: NextFlowNodeInfo;

    try {
      nextFlowNode = await this.executeInternally(token, processTokenFacade, processModelFacade, identity);
    } catch (error) {
      await processTokenFacade.addResultForFlowNode(this.flowNode.id, error);
      throw error;
    }

    if (!nextFlowNode) {
      throw new Error(`Next flow node after node with id "${this.flowNode.id}" could not be found.`);
    }

    await this.afterExecute(nextFlowNode.flowNode, nextFlowNode.processTokenFacade, processModelFacade);

    return nextFlowNode;
  }

  public async resume(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                      processTokenFacade: IProcessTokenFacade,
                      processModelFacade: IProcessModelFacade,
                      identity: IIdentity,
                     ): Promise<NextFlowNodeInfo> {

    this._previousFlowNodeInstanceId = flowNodeInstance.previousFlowNodeInstanceId;
    this._flowNodeInstanceId = flowNodeInstance.id;

    let nextFlowNode: NextFlowNodeInfo;

    try {
      nextFlowNode = await this.resumeInternally(flowNodeInstance, processTokenFacade, processModelFacade, identity);
    } catch (error) {
      await processTokenFacade.addResultForFlowNode(this.flowNode.id, error);
      throw error;
    }

    if (!nextFlowNode) {
      throw new Error(`Next flow node after node with id "${this.flowNode.id}" could not be found.`);
    }

    await this.afterExecute(nextFlowNode.flowNode, nextFlowNode.processTokenFacade, processModelFacade);

    return nextFlowNode;
  }

  public getInstanceId(): string {
    return this.flowNodeInstanceId;
  }

  public getFlowNode(): TFlowNode {
    return this.flowNode;
  }

  /**
   * This is the method where the derived handlers must implement their logic
   * for executing new FlowNodeInstances.
   *
   * Here, the actual execution of the FlowNodes takes place.
   *
   * @async
   * @param token              The current ProcessToken.
   * @param processTokenFacade The ProcessTokenFacade of the curently
   *                           running process.
   * @param processModelFacade The ProcessModelFacade of the curently
   *                           running process.
   * @param identity           The requesting users identity.
   */
  protected async abstract executeInternally(token: Runtime.Types.ProcessToken,
                                             processTokenFacade: IProcessTokenFacade,
                                             processModelFacade: IProcessModelFacade,
                                             identity: IIdentity,
                                            ): Promise<NextFlowNodeInfo>;

  /**
   * This is the method where the derived handlers must implement their logic
   * for resuming a previously interrupted instance.
   *
   * @async
   * @param   flowNodeInstance   The current ProcessToken.
   * @param   processTokenFacade The ProcessTokenFacade of the curently
   *                             running process.
   * @param   processModelFacade The ProcessModelFacade of the curently
   *                             running process.
   * @param   identity           The identity of the user that originally
   *                             started the ProcessInstance.
   * @returns                    The Info for the next FlowNode to run.
   */
  protected async abstract resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                            processTokenFacade: IProcessTokenFacade,
                                            processModelFacade: IProcessModelFacade,
                                            identity: IIdentity,
                                           ): Promise<NextFlowNodeInfo>;

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
  protected async _continueAfterEnter(onEnterToken: Runtime.Types.ProcessToken,
                                      processTokenFacade: IProcessTokenFacade,
                                      processModelFacade: IProcessModelFacade,
                                      identity?: IIdentity,
                                    ): Promise<NextFlowNodeInfo> {

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
  protected async _continueAfterSuspend(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                        onSuspendToken: Runtime.Types.ProcessToken,
                                        processTokenFacade: IProcessTokenFacade,
                                        processModelFacade: IProcessModelFacade,
                                        identity?: IIdentity,
                                       ): Promise<NextFlowNodeInfo> {

    processTokenFacade.addResultForFlowNode(this.flowNode.id, onSuspendToken.payload);

    return this.getNextFlowNodeInfo(onSuspendToken, processTokenFacade, processModelFacade);
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
  protected async _continueAfterResume(resumeToken: Runtime.Types.ProcessToken,
                                       processTokenFacade: IProcessTokenFacade,
                                       processModelFacade: IProcessModelFacade,
                                       identity?: IIdentity,
                                      ): Promise<NextFlowNodeInfo> {

    processTokenFacade.addResultForFlowNode(this.flowNode.id, resumeToken.payload);

    return this.getNextFlowNodeInfo(resumeToken, processTokenFacade, processModelFacade);
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
   * @returns                    The Info for the next FlowNode to run.
   */
  protected async _continueAfterExit(onExitToken: Runtime.Types.ProcessToken,
                                     processTokenFacade: IProcessTokenFacade,
                                     processModelFacade: IProcessModelFacade,
                                    ): Promise<NextFlowNodeInfo> {

    processTokenFacade.addResultForFlowNode(this.flowNode.id, onExitToken.payload);

    return this.getNextFlowNodeInfo(onExitToken, processTokenFacade, processModelFacade);
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
  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade,
                                  identity?: IIdentity,
                                 ): Promise<NextFlowNodeInfo> {
    return this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);
  }

  /**
   * Persists the current state of the FlowNodeInstance, after it successfully started execution.
   *
   * @async
   * @param processToken               The current ProcessToken of the FlowNodeInstance.
   */
  protected async persistOnEnter(processToken: Runtime.Types.ProcessToken): Promise<void> {

    await this.flowNodeInstanceService.persistOnEnter(this.flowNode, this.flowNodeInstanceId, processToken, this.previousFlowNodeInstanceId);

    const now: moment.Moment = moment.utc();

    this.metricsApiService.writeOnFlowNodeInstanceEnter(processToken.correlationId,
                                                     processToken.processModelId,
                                                     this.flowNodeInstanceId,
                                                     this.flowNode.id,
                                                     processToken,
                                                     now);

    this.loggingApiService.writeLogForFlowNode(processToken.correlationId,
                                               processToken.processModelId,
                                               processToken.processInstanceId,
                                               this.flowNodeInstanceId,
                                               this.flowNode.id,
                                               LogLevel.info,
                                               'Flow Node execution started.');
  }

  /**
   * Persists the current state of the FlowNodeInstance, after it successfully finished execution.
   *
   * @async
   * @param processToken     The current ProcessToken of the FlowNodeInstance.
   */
  protected async persistOnExit(processToken: Runtime.Types.ProcessToken): Promise<void> {

    await this.flowNodeInstanceService.persistOnExit(this.flowNode, this.flowNodeInstanceId, processToken);

    const now: moment.Moment = moment.utc();

    this.metricsApiService.writeOnFlowNodeInstanceExit(processToken.correlationId,
                                                    processToken.processModelId,
                                                    this.flowNodeInstanceId,
                                                    this.flowNode.id,
                                                    processToken,
                                                    now);

    this.loggingApiService.writeLogForFlowNode(processToken.correlationId,
                                               processToken.processModelId,
                                               processToken.processInstanceId,
                                               this.flowNodeInstanceId,
                                               this.flowNode.id,
                                               LogLevel.info,
                                               'Flow Node execution finished.');
  }

  /**
   * Persists the current state of the FlowNodeInstance, after it was aborted, due to process termination.
   *
   * @async
   * @param processToken     The current ProcessToken of the FlowNodeInstance.
   */
  protected async persistOnTerminate(processToken: Runtime.Types.ProcessToken): Promise<void> {

    await this.flowNodeInstanceService.persistOnTerminate(this.flowNode, this.flowNodeInstanceId, processToken);

    const now: moment.Moment = moment.utc();

    this.metricsApiService.writeOnFlowNodeInstanceExit(processToken.correlationId,
                                                    processToken.processModelId,
                                                    this.flowNodeInstanceId,
                                                    this.flowNode.id,
                                                    processToken,
                                                    now);

    this.loggingApiService.writeLogForFlowNode(processToken.correlationId,
                                               processToken.processModelId,
                                               processToken.processInstanceId,
                                               this.flowNodeInstanceId,
                                               this.flowNode.id,
                                               LogLevel.error,
                                               'Flow Node execution terminated.');
  }

  /**
   * Persists the current state of the FlowNodeInstance, after it encountered an error.
   *
   * @async
   * @param processToken     The current ProcessToken of the FlowNodeInstance.
   */
  protected async persistOnError(processToken: Runtime.Types.ProcessToken, error: Error): Promise<void> {

    await this.flowNodeInstanceService.persistOnError(this.flowNode, this.flowNodeInstanceId, processToken, error);

    const now: moment.Moment = moment.utc();

    this.metricsApiService.writeOnFlowNodeInstanceError(processToken.correlationId,
                                                     processToken.processModelId,
                                                     this.flowNodeInstanceId,
                                                     this.flowNode.id,
                                                     processToken,
                                                     error,
                                                     now);

    this.loggingApiService.writeLogForFlowNode(processToken.correlationId,
                                               processToken.processModelId,
                                               processToken.processInstanceId,
                                               this.flowNodeInstanceId,
                                               this.flowNode.id,
                                               LogLevel.error,
                                              `Flow Node execution failed: ${error.message}`);
  }

  /**
   * Suspends the execution of the given FlowNodeInstance.
   *
   * @async
   * @param processToken     The current ProcessToken of the FlowNodeInstance.
   */
  protected async persistOnSuspend(processToken: Runtime.Types.ProcessToken): Promise<void> {

    await this.flowNodeInstanceService.suspend(this.flowNode.id, this.flowNodeInstanceId, processToken);

    const now: moment.Moment = moment.utc();

    this.metricsApiService.writeOnFlowNodeInstanceSuspend(processToken.correlationId,
                                                       processToken.processModelId,
                                                       this.flowNodeInstanceId,
                                                       this.flowNode.id,
                                                       processToken,
                                                       now);

    this.loggingApiService.writeLogForFlowNode(processToken.correlationId,
                                               processToken.processModelId,
                                               processToken.processInstanceId,
                                               this.flowNodeInstanceId,
                                               this.flowNode.id,
                                               LogLevel.info,
                                               'Flow Node execution suspended.');
  }

  /**
   * Resumes execution of the given suspended FlowNodeInstance.
   *
   * @async
   * @param processToken     The current ProcessToken of the FlowNodeInstance.
   */
  protected async persistOnResume(processToken: Runtime.Types.ProcessToken): Promise<void> {

    await this.flowNodeInstanceService.resume(this.flowNode.id, this.flowNodeInstanceId, processToken);

    const now: moment.Moment = moment.utc();

    this.metricsApiService.writeOnFlowNodeInstanceResume(processToken.correlationId,
                                                      processToken.processModelId,
                                                      this.flowNodeInstanceId,
                                                      this.flowNode.id,
                                                      processToken,
                                                      now);

    this.loggingApiService.writeLogForFlowNode(processToken.correlationId,
                                               processToken.processModelId,
                                               processToken.processInstanceId,
                                               this.flowNodeInstanceId,
                                               this.flowNode.id,
                                               LogLevel.info,
                                               'Flow Node execution resumed.');
  }

  /**
   * Gets the FlowNodeInfo about the next FlowNode to execute after this
   * handler has finished.
   *
   * @async
   * @param token              The current Processtoken.
   * @param processTokenFacade The ProcessTokenFacade to use with the next FlowNode.
   * @param processModelFacade The ProcessModelFacade to use with the next FlowNode.
   * @returns                  The NextFlowNodeInfo object for the next FlowNode
   *                           to run.
   */
  protected async getNextFlowNodeInfo(token: Runtime.Types.ProcessToken,
                                      processTokenFacade: IProcessTokenFacade,
                                      processModelFacade: IProcessModelFacade,
                                     ): Promise<NextFlowNodeInfo> {
    const nextFlowNode: Model.Base.FlowNode = await processModelFacade.getNextFlowNodeFor(this.flowNode);

    return new NextFlowNodeInfo(nextFlowNode, token, processTokenFacade);
  }

  /**
   * Performs post-execution operations for the FlowNode that this Handler is
   * responsible for.
   *
   * @async
   * @param nextFlowNode       The FlowNode that follows after this one.
   * @param processTokenFacade The ProcessTokenFacade of the curently running
   *                           process.
   * @param processModelFacade The ProcessModelFacade of the curently running
   *                           process.
   */
  private async afterExecute(nextFlowNode: Model.Base.FlowNode,
                             processTokenFacade: IProcessTokenFacade,
                             processModelFacade: IProcessModelFacade): Promise<void> {

    await processTokenFacade.evaluateMapperForFlowNode(this.flowNode);

    const nextSequenceFlow: Model.Types.SequenceFlow = processModelFacade.getSequenceFlowBetween(this.flowNode, nextFlowNode);

    if (!nextSequenceFlow) {
      return;
    }

    await processTokenFacade.evaluateMapperForSequenceFlow(nextSequenceFlow);
  }
}
