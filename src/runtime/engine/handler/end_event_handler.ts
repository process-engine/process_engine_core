import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {
  EndEventReachedMessage,
  IExecutionContextFacade,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  MessageEndEventReachedMessage,
  Model,
  NextFlowNodeInfo,
  Runtime,
  SignalEndEventReachedMessage,
  TerminateEndEventReachedMessage,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class EndEventHandler extends FlowNodeHandler<Model.Events.EndEvent> {

  private _eventAggregator: IEventAggregator;
  private _flowNodeInstanceService: IFlowNodeInstanceService;

  constructor(eventAggregator: IEventAggregator, flowNodeInstanceService: IFlowNodeInstanceService) {
    super();
    this._eventAggregator = eventAggregator;
    this._flowNodeInstanceService = flowNodeInstanceService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  private get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
  }

  protected async executeInternally(flowNode: Model.Events.EndEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    await this.flowNodeInstanceService.persistOnEnter(flowNode.id, this.flowNodeInstanceId, token);

    const isTerminateEndEvent: boolean = flowNode.terminateEventDefinition !== undefined;
    const isErrorEndEvent: boolean = flowNode.errorEventDefinition !== undefined;
    const isMessageEndEvent: boolean = flowNode.messageEventDefinition !== undefined;
    const isSignalEndEvent: boolean = flowNode.signalEventDefinition !== undefined;

    let errorObj: any;

    // Event processing
    if (isTerminateEndEvent) {
      this._processTerminateEndEvent(flowNode, token);
    } else if (isErrorEndEvent) {
      errorObj = this._processErrorEndEvent(flowNode);
    } else if (isMessageEndEvent) {
      this._processMessageEndEvent(flowNode, token);
    } else if (isSignalEndEvent) {
      this._processSignalEndEvent(flowNode, token);
    } else {
      this._processRegularEndEvent(flowNode, token);
    }

    // Event persisting
    if (isTerminateEndEvent) {
      await this.flowNodeInstanceService.persistOnTerminate(flowNode.id, this.flowNodeInstanceId, token);
    } else {
      await this.flowNodeInstanceService.persistOnExit(flowNode.id, this.flowNodeInstanceId, token);
    }

    // Finalization
    if (isErrorEndEvent) {
      // ErrorEndEvents need to cause Promise rejection with the matching error object.
      return Promise.reject(errorObj);
    }

    return new NextFlowNodeInfo(undefined, token, processTokenFacade);
  }

  /**
   * When a MessageEndEvent is used, an event with the corresponding message is
   * published to the EventAggregator.
   * Afterwards, the process finishes regularly.
   *
   * @param flowNode The FlowNode containing the Message definition
   * @param token    The current ProcessToken.
   */
  private _processMessageEndEvent(flowNode: Model.Events.EndEvent, token: Runtime.Types.ProcessToken): void {

    // Send message to processes that may be waiting for it.
    const messageName: string = `/processengine/process/message/${flowNode.messageEventDefinition.messageRef}`;
    const payload: MessageEndEventReachedMessage = new MessageEndEventReachedMessage(flowNode.id, token.payload);
    this.eventAggregator.publish(messageName, payload);

    // End the process regularly.
    this._processRegularEndEvent(flowNode, token);
  }

  /**
   * When a SignalEndEvent is used, an event with the corresponding signal is
   * published to the EventAggregator.
   * Afterwards, the process finishes regularly.
   *
   * @param flowNode The FlowNode containing the Message definition
   * @param token    The current ProcessToken.
   */
  private _processSignalEndEvent(flowNode: Model.Events.EndEvent, token: Runtime.Types.ProcessToken): void {

    // Send message to processes that may be waiting for it.
    const messageName: string = `/processengine/process/signal/${flowNode.signalEventDefinition.signalRef}`;
    const payload: SignalEndEventReachedMessage = new SignalEndEventReachedMessage(flowNode.id, token.payload);
    this.eventAggregator.publish(messageName, payload);

    // End the process regularly.
    this._processRegularEndEvent(flowNode, token);
  }

  /**
   * When a TerminateEndEvent is used, an event with the corresponding
   * termination notification is published to the EventAggregator.
   *
   * @param flowNode The FlowNode containing the termination definition
   * @param token    The current ProcessToken.
   */
  private _processTerminateEndEvent(flowNode: Model.Events.EndEvent, token: Runtime.Types.ProcessToken): void {

    // Publish termination message to cancel all FlowNodeInstance executions and finish with an error.
    const event: string = `/processengine/process/${token.processInstanceId}/terminated`;
    const payload: TerminateEndEventReachedMessage = new TerminateEndEventReachedMessage(flowNode.id, token.payload);
    this.eventAggregator.publish(event, payload);
  }

  /**
   * When an ErrorEndEvent is used, this will reate an error object with which
   * to end the process.
   * The process will not be finished regularly in this case.
   *
   * @param flowNode The FlowNode containing the termination definition
   * @param token    The current ProcessToken.
   */
  private _processErrorEndEvent(flowNode: Model.Events.EndEvent): any {

    // Create customized error object, based on the error definition.
    const errorEventDefinition: Model.Types.Error = flowNode.errorEventDefinition.errorReference;
    const errorObject: {errorCode: string, name: string} = {
      errorCode: errorEventDefinition.errorCode,
      name: errorEventDefinition.name,
    };

    // Return the created Error object. Don't publish a success message here.
    return errorObject;
  }

  /**
   * Finishes a regular EndEvent, by simply publishing the corresponding notification.
   *
   * @param flowNode The EndEvent to process.
   * @param token    The current ProcessToken.
   */
  private _processRegularEndEvent(flowNode: Model.Events.EndEvent, token: Runtime.Types.ProcessToken): void {
    // Publish regular success messsage.
    const event: string = `/processengine/correlation/${token.correlationId}/process/${token.processModelId}/node/${flowNode.id}`;
    const payload: EndEventReachedMessage = new EndEventReachedMessage(flowNode.id, token.payload);
    this.eventAggregator.publish(event, payload);
  }
}
