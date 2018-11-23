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

import * as moment from 'moment';
import * as uuid from 'uuid';

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
              flowNode: TFlowNode,
            ) {
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._loggingApiService = loggingApiService;
    this._metricsApiService = metricsApiService;
    this._flowNode = flowNode;
  }

  protected get flowNodeInstanceId(): string {

    const noInstanceIdExists: boolean = this._flowNodeInstanceId === undefined;
    if (noInstanceIdExists) {
      this._flowNodeInstanceId = this.createFlowNodeInstanceId();
    }

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
      // TODO: (SM) this is only to support the old implementation
      //            I would like to set no token result or further specify it to be an error to avoid confusion
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
   * This is the method where the derived handlers must implement their logic.
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
   * Creates an instance ID for the FlowNode that this handler is responsible for.
   *
   * @returns The created FlowNodeInstanceId.
   */
  protected createFlowNodeInstanceId(): string {
    return uuid.v4();
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
   * @param processTokenFacade The ProcessTokenFacade to use with the next
   *                           FlowNode.
   * @param processModelFacade The ProcessModelFacade to use with the next
   *                           FlowNode.
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
   * This includes evaluating mappers on the succeeding FlowNodes or
   * SequenceFlows.
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

    // There are two kinds of Mappers to evaluate: FlowNode- and SequenceFlow-Mappers.
    // They are evaluated in between handling of FlowNodes.
    await processTokenFacade.evaluateMapperForFlowNode(this.flowNode);

    const nextSequenceFlow: Model.Types.SequenceFlow = processModelFacade.getSequenceFlowBetween(this.flowNode, nextFlowNode);

    if (!nextSequenceFlow) {
      return;
    }

    await processTokenFacade.evaluateMapperForSequenceFlow(nextSequenceFlow);
  }
}
