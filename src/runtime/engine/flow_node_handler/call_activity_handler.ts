import {Logger} from 'loggerhythm';

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
    this.logger = new Logger(`processengine:call_activity_handler:${callActivityModel.id}`);
  }

  private get callActivity(): Model.Activities.CallActivity {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Executing CallActivity instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _continueAfterSuspend(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                        onSuspendToken: Runtime.Types.ProcessToken,
                                        processTokenFacade: IProcessTokenFacade,
                                        processModelFacade: IProcessModelFacade,
                                        identity: IIdentity,
                                      ): Promise<NextFlowNodeInfo> {

    // First we need to find out if the Subprocess was already started.
    const correlation: Runtime.Types.Correlation
      = await this._correlationService.getSubprocessesForProcessInstance(flowNodeInstance.processInstanceId);

    const noSubProcessesFound: boolean = correlation === undefined;

    const matchingSubProcess: Runtime.Types.CorrelationProcessModel = noSubProcessesFound
      ? undefined
      : correlation.processModels.find((entry: Runtime.Types.CorrelationProcessModel): boolean => {
          return entry.processModelId === this.callActivity.calledReference;
        });

    let callActivityResult: any;

    const callActivityNotYetExecuted: boolean = matchingSubProcess === undefined;
    if (callActivityNotYetExecuted) {
      // Subprocess not yet started. We need to run the handler again.
      const startEventId: string = await this._getAccessibleCallActivityStartEvent(identity);

      const processStartResponse: ProcessStartResponsePayload =
        await this._executeSubprocess(identity, startEventId, processTokenFacade, onSuspendToken);

      callActivityResult = processStartResponse.tokenPayload;
    } else {
      // Subprocess was already started. Resume it and wait for the result:
      callActivityResult =
        await this._resumeProcessService.resumeProcessInstanceById(identity, matchingSubProcess.processModelId, matchingSubProcess.processInstanceId);
    }

    onSuspendToken.payload = callActivityResult;
    await this.persistOnResume(onSuspendToken);
    await processTokenFacade.addResultForFlowNode(this.callActivity.id, callActivityResult);
    await this.persistOnExit(onSuspendToken);

    return this.getNextFlowNodeInfo(onSuspendToken, processTokenFacade, processModelFacade);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
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
