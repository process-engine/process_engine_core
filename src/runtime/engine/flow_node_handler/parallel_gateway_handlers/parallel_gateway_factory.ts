import {IContainer} from 'addict-ioc';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';
import {
  IFlowNodeHandler,
  IFlowNodeHandlerDedicatedFactory,
  Model,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from '../flow_node_handler';

export class ParallelGatewayFactory implements IFlowNodeHandlerDedicatedFactory<Model.Gateways.ParallelGateway> {

  private _container: IContainer;

  constructor(container: IContainer) {
    this._container = container;
  }

  public async create(flowNode: Model.Gateways.ParallelGateway): Promise<IFlowNodeHandler<Model.Gateways.ParallelGateway>> {

    switch (flowNode.gatewayDirection) {
      case Model.Gateways.GatewayDirection.Converging:
        return this._container.resolve<FlowNodeHandler<Model.Gateways.ParallelGateway>>('ParallelJoinGatewayHandler', [flowNode]);
      case Model.Gateways.GatewayDirection.Diverging:
        return this._container.resolve<FlowNodeHandler<Model.Gateways.ParallelGateway>>('ParallelSplitGatewayHandler', [flowNode]);
      default:
        const unsupportedErrorMessage: string =
          `ParallelGateway ${flowNode.id} is neither a Split- nor a Join-Gateway! Mixed Gateways are NOT supported!`;
        throw new UnprocessableEntityError(unsupportedErrorMessage);
    }
  }
}
