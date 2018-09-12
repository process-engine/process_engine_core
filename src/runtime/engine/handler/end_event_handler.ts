import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {
  eventAggregatorSettings,
  IExecutionContextFacade,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  ProcessEndedMessage,
  ProcessTerminatedMessage,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class EndEventHandler extends FlowNodeHandler<Model.Events.EndEvent> {

  private _flowNodeInstanceService: IFlowNodeInstanceService = undefined;
  private _eventAggregator: IEventAggregator = undefined;

  constructor(flowNodeInstanceService: IFlowNodeInstanceService, eventAggregator: IEventAggregator) {
    super();
    this._flowNodeInstanceService = flowNodeInstanceService;
    this._eventAggregator = eventAggregator;
  }

  private get flowNodeInstanceService(): IFlowNodeInstanceService {
    return this._flowNodeInstanceService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  protected async executeInternally(flowNode: Model.Events.EndEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    await this.flowNodeInstanceService.persistOnEnter(flowNode.id, this.flowNodeInstanceId, token);

    const flowNodeHasTerminateEventDefinition: boolean = flowNode.terminateEventDefinition !== undefined;
    if (flowNodeHasTerminateEventDefinition) {
      await this.flowNodeInstanceService.persistOnTerminate(flowNode.id, this.flowNodeInstanceId, token);
      this._sendProcessTerminatedToConsumerApi(token.correlationId, token.processInstanceId, flowNode.id, token.payload);
    } else {
      await this.flowNodeInstanceService.persistOnExit(flowNode.id, this.flowNodeInstanceId, token);
      this._sendProcessEndedToConsumerApi(token.correlationId, token.processInstanceId, flowNode.id, token.payload);
    }

    if (flowNode.errorEventDefinition) {
      const errorEventDefinition: Model.Types.Error = flowNode.errorEventDefinition.errorReference;
      const errorObject: {errorCode: string, name: string} = {
        errorCode: errorEventDefinition.errorCode,
        name: errorEventDefinition.name,
      };

      // In case of ErrorEndEvents, the Promise managing the process execution
      // needs to be rejected with the matching error object.
      return Promise.reject(errorObject);
    }

    return new NextFlowNodeInfo(undefined, token, processTokenFacade);
  }

  private _sendProcessTerminatedToConsumerApi(correlationId: string,
                                              processInstanceId: string,
                                              flowNodeId: string,
                                              tokenPayload: any): void {
    const message: ProcessTerminatedMessage = new ProcessTerminatedMessage();
    message.correlationId = correlationId;
    message.processInstanceId = processInstanceId;
    message.flowNodeId = flowNodeId;
    message.tokenPayload = tokenPayload;
    this.eventAggregator.publish(eventAggregatorSettings.paths.processTerminated, message);
  }

  private _sendProcessEndedToConsumerApi(correlationId: string,
                                         processInstanceId: string,
                                         flowNodeId: string,
                                         tokenPayload: any): void {
    const message: ProcessEndedMessage = new ProcessEndedMessage();
    message.correlationId = correlationId;
    message.processInstanceId = processInstanceId;
    message.flowNodeId = flowNodeId;
    message.tokenPayload = tokenPayload;
    this.eventAggregator.publish(eventAggregatorSettings.paths.processEnded, message);
  }
}
