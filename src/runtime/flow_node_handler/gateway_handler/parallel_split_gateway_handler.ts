import {Logger} from 'loggerhythm';

import {InternalServerError} from '@essential-projects/errors_ts';
import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {Model, ProcessToken} from '@process-engine/persistence_api.contracts';
import {
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessTokenFacade,
} from '@process-engine/process_engine_contracts';

import {ProcessModelFacade} from '../../facades/process_model_facade';
import {GatewayHandler} from './index';

export class ParallelSplitGatewayHandler extends GatewayHandler<Model.Gateways.ParallelGateway> {

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    parallelGatewayModel: Model.Gateways.ParallelGateway,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, parallelGatewayModel);
    this.logger = Logger.createLogger(`processengine:parallel_split_gateway:${parallelGatewayModel.id}`);
  }

  private get parallelGateway(): Model.Gateways.ParallelGateway {
    return this.flowNode;
  }

  protected async startExecution(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: ProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing ParallelSplitGateway instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this.executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: ProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    try {
      const joinGateway = processModelFacade.findJoinGatewayAfterSplitGateway(this.parallelGateway);

      if (!joinGateway) {
        throw new InternalServerError(`No matching Join Gateway was found for ParallelSplitGateway ${this.parallelGateway.id}!`);
      }

      await this.flowNodeHandlerFactory.create(joinGateway, token);

      processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, {});
      await this.persistOnExit(token);

      return processModelFacade.getNextFlowNodesFor(this.parallelGateway);
    } catch (error) {
      this.logger.error('Failed to discover Join Gateway!', error);
      throw error;
    }
  }

}
