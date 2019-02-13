import {Logger} from 'loggerhythm';

import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {
  eventAggregatorSettings,
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  ProcessStartedMessage,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class StartEventHandler extends FlowNodeHandler<Model.Events.StartEvent> {

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    startEventModel: Model.Events.StartEvent,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, startEventModel);
    this.logger = new Logger(`processengine:start_event_handler:${startEventModel.id}`);
  }

  private get startEvent(): Model.Events.StartEvent {
    return super.flowNode;
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing StartEvent instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade,
                                  identity: IIdentity): Promise<Array<Model.Base.FlowNode>> {

    this._sendProcessStartedMessage(identity, token, this.startEvent.id);

    processTokenFacade.addResultForFlowNode(this.startEvent.id, this.flowNodeInstanceId, token.payload);
    await this.persistOnExit(token);

    return processModelFacade.getNextFlowNodesFor(this.startEvent);
  }

  /**
   * Sends a message that the ProcessInstance was started.
   *
   * @param identity     The identity that owns the StartEvent instance.
   * @param token        Current token object, which contains all necessary Process Metadata.
   * @param startEventId Id of the used StartEvent.
   */
  private _sendProcessStartedMessage(identity: IIdentity, token: Runtime.Types.ProcessToken, startEventId: string): void {
    const processStartedMessage: ProcessStartedMessage = new ProcessStartedMessage(token.correlationId,
      token.processModelId,
      token.processInstanceId,
      startEventId,
      this.flowNodeInstanceId,
      identity,
      token.payload);

    this.eventAggregator.publish(eventAggregatorSettings.messagePaths.processStarted, processStartedMessage);

    const processStartedBaseName: string = eventAggregatorSettings.messagePaths.processInstanceStarted;
    const processModelIdParam: string = eventAggregatorSettings.messageParams.processModelId;
    const processWithIdStartedMessage: string =
      processStartedBaseName
        .replace(processModelIdParam, token.processModelId);

    this.eventAggregator.publish(processWithIdStartedMessage, processStartedMessage);
  }
}
