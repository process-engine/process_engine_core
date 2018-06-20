import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {
  EndEventReachedMessage,
  IExecutionContextFacade,
  IFlowNodeInstancePersistence,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class EndEventHandler extends FlowNodeHandler<Model.Events.EndEvent> {

  private _flowNodeInstancePersistence: IFlowNodeInstancePersistence = undefined;
  private _eventAggregator: IEventAggregator = undefined;

  constructor(flowNodeInstancePersistence: IFlowNodeInstancePersistence, eventAggregator: IEventAggregator) {
    super();
    this._flowNodeInstancePersistence = flowNodeInstancePersistence;
    this._eventAggregator = eventAggregator;
  }

  private get flowNodeInstancePersistence(): IFlowNodeInstancePersistence {
    return this._flowNodeInstancePersistence;
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

    await this.flowNodeInstancePersistence.persistOnEnter(token, flowNode.id, flowNodeInstanceId);
    await this.flowNodeInstancePersistence.persistOnExit(token, flowNode.id, flowNodeInstanceId);

    this.eventAggregator.publish(`/processengine/node/${flowNode.id}`, new EndEventReachedMessage(flowNode.id, token.payload));

    if (flowNode.errorEventDefinition) {
      const errorEventDefinition: Model.Types.Error = flowNode.errorEventDefinition.errorReference;
      const errorObject: {error_code: string, name: string} = {
        error_code: errorEventDefinition.errorCode,
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
