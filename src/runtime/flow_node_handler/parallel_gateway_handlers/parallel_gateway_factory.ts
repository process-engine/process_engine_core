import {IContainer} from 'addict-ioc';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';
import {
  IFlowNodeHandler,
  IFlowNodeHandlerDedicatedFactory,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from '../flow_node_handler';

export class ParallelGatewayFactory implements IFlowNodeHandlerDedicatedFactory<Model.Gateways.ParallelGateway> {

  private _container: IContainer;

  constructor(container: IContainer) {
    this._container = container;
  }

  public async create(
    flowNode: Model.Gateways.ParallelGateway,
    processToken: Runtime.Types.ProcessToken,
  ): Promise<IFlowNodeHandler<Model.Gateways.ParallelGateway>> {

    switch (flowNode.gatewayDirection) {
      case Model.Gateways.GatewayDirection.Converging:

        const joinGatewayRegistration: string =
          `ParallelJoinGatewayHandlerInstance-${processToken.correlationId}-${processToken.processInstanceId}-${flowNode.id}`;

        // If a matching instance for the requested Join-Gateway already exists, return that one.
        if (this._container.isRegistered(joinGatewayRegistration)) {
          return this._container.resolveAsync<FlowNodeHandler<Model.Gateways.ParallelGateway>>(joinGatewayRegistration, [flowNode]);
        }

        // If no such instance exists, create a new one and store it in the container for later use.
        // This way, the Join-Gateway can be used across multiple parallel branches.
        const handlerInstance: FlowNodeHandler<Model.Gateways.ParallelGateway> =
          await this._container.resolveAsync<FlowNodeHandler<Model.Gateways.ParallelGateway>>('ParallelJoinGatewayHandler', [flowNode]);

        this._container.registerObject(joinGatewayRegistration, handlerInstance);

        return handlerInstance;
      case Model.Gateways.GatewayDirection.Diverging:
        return this._container.resolveAsync<FlowNodeHandler<Model.Gateways.ParallelGateway>>('ParallelSplitGatewayHandler', [flowNode]);
      default:
        const unsupportedErrorMessage: string =
          `ParallelGateway ${flowNode.id} is neither a Split- nor a Join-Gateway! Mixed Gateways are NOT supported!`;
        throw new UnprocessableEntityError(unsupportedErrorMessage);
    }
  }
}
