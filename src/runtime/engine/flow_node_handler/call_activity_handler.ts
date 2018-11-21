
import {InternalServerError} from '@essential-projects/errors_ts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {
  IConsumerApi,
  ProcessModel,
  ProcessStartRequestPayload,
  ProcessStartResponsePayload,
  StartCallbackType,
} from '@process-engine/consumer_api_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  ICorrelationService,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  IResumeProcessService,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class CallActivityHandler extends FlowNodeHandler<Model.Activities.CallActivity> {

  private _consumerApiService: IConsumerApi;
  private _correlationService: ICorrelationService;
  private _resumeProcessService: IResumeProcessService;

  constructor(consumerApiService: IConsumerApi,
              correlationService: ICorrelationService,
              flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              resumeProcessService: IResumeProcessService,
              callActivityModel: Model.Activities.CallActivity) {
    super(flowNodeInstanceService, loggingApiService, metricsService, callActivityModel);

    this._consumerApiService = consumerApiService;
    this._correlationService = correlationService;
    this._resumeProcessService = resumeProcessService;
  }

  private get callActivity(): Model.Activities.CallActivity {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  public async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                identity: IIdentity,
                              ): Promise<NextFlowNodeInfo> {

    switch (flowNodeInstance.state) {
      case Runtime.Types.FlowNodeInstanceState.suspended:
        return this._continueAfterSuspend(flowNodeInstance, processTokenFacade, processModelFacade, identity);
      case Runtime.Types.FlowNodeInstanceState.running:

        const resumeToken: Runtime.Types.ProcessToken =
          flowNodeInstance.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
            return token.type === Runtime.Types.ProcessTokenType.onResume;
          });

        const callActivityNotYetExecuted: boolean = resumeToken === undefined;

        if (callActivityNotYetExecuted) {
          return this._continueAfterEnter(flowNodeInstance, processTokenFacade, processModelFacade, identity);
        }

        return this._continueAfterResume(resumeToken, processTokenFacade, processModelFacade);
      default:
        throw new InternalServerError(`Cannot resume CallActivity instance ${flowNodeInstance.id}, because it was already finished!`);
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
   * @param   flowNodeInstance   The FlowNodeInstance to resume.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @param   identity           The requesting user's identity.
   * @returns                    The Info for the next FlowNode to run.
   */
  private async _continueAfterEnter(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity,
                                   ): Promise<NextFlowNodeInfo> {

    // When the FNI was interrupted directly after the onEnter state change, only one token will be present.
    const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.tokens[0];

    return this._executeHandler(onEnterToken, processTokenFacade, processModelFacade, identity);
  }

  /**
   * Resumes the given FlowNodeInstance from the point where it assumed the
   * "onSuspended" state.
   *
   * When the FlowNodeInstance was interrupted during this stage, we need to
   * run the handler again, except for the "onSuspend" state change.
   *
   * @async
   * @param   flowNodeInstance   The FlowNodeInstance to resume.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @param   identity           The requesting user's identity.
   * @returns                    The Info for the next FlowNode to run.
   */
  private async _continueAfterSuspend(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                      processTokenFacade: IProcessTokenFacade,
                                      processModelFacade: IProcessModelFacade,
                                      identity: IIdentity,
                                     ): Promise<NextFlowNodeInfo> {

    const currentToken: Runtime.Types.ProcessToken =
      flowNodeInstance.tokens.find((token: Runtime.Types.ProcessToken): boolean => {
        return token.type === Runtime.Types.ProcessTokenType.onSuspend;
      });

    // First we need to find out if the Subprocess was already started.
    const correlation: Runtime.Types.Correlation
      = await this._correlationService.getSubprocessesForProcessInstance(flowNodeInstance.processInstanceId);

    const matchingSubProcess: Runtime.Types.CorrelationProcessModel =
      correlation.processModels.find((entry: Runtime.Types.CorrelationProcessModel): boolean => {
        return entry.name === this.callActivity.calledReference;
      });

    let callActivityResult: any;

    const callActivityNotYetExecuted: boolean = matchingSubProcess === undefined;
    if (callActivityNotYetExecuted) {
      // Subprocess not yet started. We need to run the handler again.
      const startEventId: string = await this._getAccessibleCallActivityStartEvent(identity);

      const processStartResponse: ProcessStartResponsePayload =
        await this._executeSubprocess(identity, startEventId, processTokenFacade, currentToken);

      callActivityResult = processStartResponse.tokenPayload;
    } else {
      // Subprocess was already started. Resume it and wait for the result:
      callActivityResult = await this._resumeProcessService.resumeProcessInstanceById(matchingSubProcess.processInstanceId);
    }

    currentToken.payload = callActivityResult;
    await this.persistOnResume(currentToken);
    await processTokenFacade.addResultForFlowNode(this.callActivity.id, callActivityResult);
    await this.persistOnExit(currentToken);

    return this.getNextFlowNodeInfo(currentToken, processTokenFacade, processModelFacade);
  }

  /**
   * Resumes the given FlowNodeInstance from the point where it assumed the
   * "onResumed" state.
   *
   * Basically, the StartEvent was already finished.
   * The final result is only missing in the database.
   *
   * @async
   * @param   resumeToken   The FlowNodeInstance to resume.
   * @param   processTokenFacade The ProcessTokenFacade to use for resuming.
   * @param   processModelFacade The processModelFacade to use for resuming.
   * @returns                    The Info for the next FlowNode to run.
   */
  private async _continueAfterResume(resumeToken: Runtime.Types.ProcessToken,
                                     processTokenFacade: IProcessTokenFacade,
                                     processModelFacade: IProcessModelFacade,
                                    ): Promise<NextFlowNodeInfo> {

    processTokenFacade.addResultForFlowNode(this.callActivity.id, resumeToken.payload);

    const nextNodeAfter: Model.Base.FlowNode = processModelFacade.getNextFlowNodeFor(this.callActivity);

    await this.persistOnExit(resumeToken);

    return new NextFlowNodeInfo(nextNodeAfter, resumeToken, processTokenFacade);
  }

  private async _executeHandler(token: Runtime.Types.ProcessToken,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                identity: IIdentity,
                               ): Promise<NextFlowNodeInfo> {

    const startEventId: string = await this._getAccessibleCallActivityStartEvent(identity);

    await this.persistOnSuspend(token);

    const processStartResponse: ProcessStartResponsePayload =
      await this._executeSubprocess(identity, startEventId, processTokenFacade, token);

    token.payload = processStartResponse.tokenPayload;

    await this.persistOnResume(token);
    await processTokenFacade.addResultForFlowNode(this.callActivity.id, processStartResponse.tokenPayload);
    await this.persistOnExit(token);

    return this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);
  }

  /**
   * Retrieves the first accessible StartEvent for the ProcessModel with the
   * given ID.
   *
   * @async
   * @param   identity The users identity.
   * @returns          The retrieved StartEvent.
   */
  private async _getAccessibleCallActivityStartEvent(identity: IIdentity): Promise<string> {

    const processModel: ProcessModel = await this._consumerApiService.getProcessModelById(identity, this.callActivity.calledReference);

    /*
     * Note: If the user cannot access the process model and/or its start events,
     * the Consumer API will already have thrown an HTTP Unauthorized error,
     * so we do not need to handle those cases here.
     */
    const startEventId: string = processModel.startEvents[0].id;

    return startEventId;
  }

  /**
   * Uses the ConsumerAPI to execute the ProcessModel defined in the
   * CallActivity FlowNode.
   *
   * @async
   * @param identity           The users identity.
   * @param startEventId       The StartEvent by which to start the SubProcess.
   * @param processTokenFacade The Facade for accessing the current process' tokens.
   * @param token              The current ProcessToken.
   */
  private async _executeSubprocess(identity: IIdentity,
                                   startEventId: string,
                                   processTokenFacade: IProcessTokenFacade,
                                   token: Runtime.Types.ProcessToken ,
                                  ): Promise<ProcessStartResponsePayload> {

    const tokenData: any = await processTokenFacade.getOldTokenFormat();

    const processInstanceId: string = token.processInstanceId;
    const correlationId: string = token.correlationId;

    const startCallbackType: StartCallbackType = StartCallbackType.CallbackOnProcessInstanceFinished;

    const payload: ProcessStartRequestPayload = {
      correlationId: correlationId,
      callerId: processInstanceId,
      inputValues: tokenData.current || {},
    };

    const processModelId: string = this.callActivity.calledReference;

    const result: ProcessStartResponsePayload =
      await this._consumerApiService.startProcessInstance(identity, processModelId, startEventId, payload, startCallbackType);

    return result;
  }
}
