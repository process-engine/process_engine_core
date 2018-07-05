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
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class EndEventHandler extends FlowNodeHandler<Model.Events.EndEvent> {

  private _flowNodeInstancePersistenceService: IFlowNodeInstanceService = undefined;
  private _eventAggregator: IEventAggregator = undefined;

  constructor(flowNodeInstancePersistenceService: IFlowNodeInstanceService, eventAggregator: IEventAggregator) {
    super();
    this._flowNodeInstancePersistenceService = flowNodeInstancePersistenceService;
    this._eventAggregator = eventAggregator;
  }

  private get flowNodeInstancePersistenceService(): IFlowNodeInstanceService {
    return this._flowNodeInstancePersistenceService;
  }

  private get eventAggregator(): IEventAggregator {
    return this._eventAggregator;
  }

  protected async executeInternally(flowNode: Model.Events.EndEvent,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    executionContextFacade: IExecutionContextFacade): Promise<NextFlowNodeInfo> {

    const flowNodeInstanceId: string = super.createFlowNodeInstanceId();

    await this.flowNodeInstancePersistenceService.persistOnEnter(executionContextFacade, token, flowNode.id, flowNodeInstanceId);
    await this.flowNodeInstancePersistenceService.persistOnExit(executionContextFacade, token, flowNode.id, flowNodeInstanceId);

    this.eventAggregator.publish(`/processengine/node/${flowNode.id}`, new EndEventReachedMessage(flowNode.id, token.payload));

    if (flowNode.errorEventDefinition) {
      const errorEventDefinition: Model.Types.Error = flowNode.errorEventDefinition.errorReference;
      const errorObject: {errorCode: string, name: string} = {
        errorCode: errorEventDefinition.errorCode,
        name: errorEventDefinition.name,
      };

      /*
       * If the ErrorEndEvent gets encountered, reject the promise
       * with the defined error object.
       */
      return Promise.reject(errorObject);
    }

    return new NextFlowNodeInfo(undefined, token, processTokenFacade);
  }
}
