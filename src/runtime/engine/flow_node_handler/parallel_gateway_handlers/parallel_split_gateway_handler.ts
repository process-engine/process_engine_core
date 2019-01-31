import {IContainer} from 'addict-ioc';
import * as clone from 'clone';
import {Logger} from 'loggerhythm';

import {InternalServerError, UnprocessableEntityError} from '@essential-projects/errors_ts';
import {IEventAggregator, Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  IFlowNodeHandler,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from '../index';

export class ParallelSplitGatewayHandler extends FlowNodeHandler<Model.Gateways.ParallelGateway> {

  constructor(container: IContainer, parallelGatewayModel: Model.Gateways.ParallelGateway) {
    super(container, parallelGatewayModel);
    this.logger = Logger.createLogger(`processengine:parallel_split_gateway:${parallelGatewayModel.id}`);
  }

  private get parallelGateway(): Model.Gateways.ParallelGateway {
    return super.flowNode;
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing ParallelSplitGateway instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getOutgoingSequenceFlowsFor(this.parallelGateway.id);

    const flowNodesToRunInParallel: Array<Model.Base.FlowNode> =
      outgoingSequenceFlows.map((flow: Model.Types.SequenceFlow) => processModelFacade.getFlowNodeById(flow.targetRef));

    return flowNodesToRunInParallel;
  }

}
