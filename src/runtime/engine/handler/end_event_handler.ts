import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {
  EndEventReachedMessage,
  IExecutionContextFacade,
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
  TerminateEndEventReachedMessage,
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

    await this.flowNodeInstanceService.persistOnEnter(executionContextFacade, token, flowNode.id, this.flowNodeInstanceId);

    const flowNodeHasTerminateEventDefinition: boolean = flowNode.terminateEventDefinition !== undefined;
    if (flowNodeHasTerminateEventDefinition) {
      await this.flowNodeInstanceService.persistOnTerminate(executionContextFacade, token, flowNode.id, this.flowNodeInstanceId);
      this.eventAggregator.publish(`/processengine/process/${token.processInstanceId}/terminated`, new TerminateEndEventReachedMessage(flowNode.id, token.payload));
    } else {
      await this.flowNodeInstanceService.persistOnExit(executionContextFacade, token, flowNode.id, this.flowNodeInstanceId);
      this.eventAggregator.publish(`/processengine/node/${flowNode.id}`, new EndEventReachedMessage(flowNode.id, token.payload));
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
}
