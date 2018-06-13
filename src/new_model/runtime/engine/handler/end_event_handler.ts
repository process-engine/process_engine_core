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

    console.log(flowNode);

    // TODO: Remove the hardcoded reference
    // TODO: The typings are completely messed up here
    if (flowNode.hasOwnProperty('errorEventDefinition')) {
      const errorEventDefinition: any = flowNode.errorEventDefinition;

      const errorObject: {errorCode: string, name: string} = {
        errorCode: errorEventDefinition.errorCode,
        name: errorEventDefinition.name,
      };

      throw errorObject;
    }

    return new NextFlowNodeInfo(undefined, token, processTokenFacade);
  }
}
