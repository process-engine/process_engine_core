import {Logger} from 'loggerhythm';

import {BadRequestError, UnprocessableEntityError} from '@essential-projects/errors_ts';
import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
import {
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {GatewayHandler} from './index';

export class ExclusiveGatewayHandler extends GatewayHandler<Model.Gateways.ExclusiveGateway> {

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    exclusiveGatewayModel: Model.Gateways.ExclusiveGateway,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, exclusiveGatewayModel);
    this.logger = new Logger(`processengine:exclusive_gateway_handler:${exclusiveGatewayModel.id}`);
  }

  private get exclusiveGateway(): Model.Gateways.ExclusiveGateway {
    return this.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing ExclusiveGateway instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this.executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async continueAfterExit(
    onExitToken: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    processTokenFacade.addResultForFlowNode(this.exclusiveGateway.id, this.flowNodeInstanceId, onExitToken.payload);

    const isExclusiveJoinGateway = this.exclusiveGateway.gatewayDirection === Model.Gateways.GatewayDirection.Converging;
    if (isExclusiveJoinGateway) {
      return processModelFacade.getNextFlowNodesFor(this.exclusiveGateway);
    }

    const outgoingSequenceFlows = processModelFacade.getOutgoingSequenceFlowsFor(this.exclusiveGateway.id);

    // Since the Gateway was finished without error, we can assume that only one outgoing SequenceFlow with a matching condition exists.
    // If this were not the case, the Gateway would not have been executed at all.
    const matchingSequenceFlows = await this.getSequenceFlowsWithMatchingCondition(outgoingSequenceFlows, processTokenFacade);

    const nextFlowNodeAfterSplit = processModelFacade.getFlowNodeById(matchingSequenceFlows[0].targetRef);

    return [nextFlowNodeAfterSplit];
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    const gatewayTypeIsNotSupported =
      this.exclusiveGateway.gatewayDirection === Model.Gateways.GatewayDirection.Unspecified ||
      this.exclusiveGateway.gatewayDirection === Model.Gateways.GatewayDirection.Mixed;

    if (gatewayTypeIsNotSupported) {
      const unsupportedErrorMessage =
        `ExclusiveGateway ${this.exclusiveGateway.id} is neither a Split- nor a Join-Gateway! Mixed Gateways are NOT supported!`;
      const unsupportedError = new UnprocessableEntityError(unsupportedErrorMessage);

      this.persistOnError(token, unsupportedError);

      throw unsupportedError;
    }

    processTokenFacade.addResultForFlowNode(this.exclusiveGateway.id, this.flowNodeInstanceId, token.payload);

    const outgoingSequenceFlows = processModelFacade.getOutgoingSequenceFlowsFor(this.exclusiveGateway.id);

    const isExclusiveJoinGateway = this.exclusiveGateway.gatewayDirection === Model.Gateways.GatewayDirection.Converging;
    if (isExclusiveJoinGateway) {

      // If this is a join gateway, just return the next FlowNode to execute.
      // Prerequisite for this UseCase is that only one outgoing SequenceFlow exists here.
      const nextFlowNodeAfterJoin = processModelFacade.getFlowNodeById(outgoingSequenceFlows[0].targetRef);

      await this.persistOnExit(token);

      return [nextFlowNodeAfterJoin];
    }

    // If this is a split gateway, find the SequenceFlow that has a truthy condition
    // and continue execution with its target FlowNode.
    const nextFlowNodeId = await this.determineBranchToTake(token, outgoingSequenceFlows, processTokenFacade);
    await this.persistOnExit(token);

    const nextFlowNodeAfterSplit = processModelFacade.getFlowNodeById(nextFlowNodeId);

    return [nextFlowNodeAfterSplit];
  }

  private async determineBranchToTake(
    token: ProcessToken,
    sequenceFlows: Array<Model.ProcessElements.SequenceFlow>,
    processTokenFacade: IProcessTokenFacade,
  ): Promise<string> {

    const truthySequenceFlows = await this.getSequenceFlowsWithMatchingCondition(sequenceFlows, processTokenFacade);

    const noTruthySequenceFlowsExist = truthySequenceFlows.length === 0;
    if (noTruthySequenceFlowsExist) {

      // if no SequenceFlows have a truthy condition, but a default Sequence Flow is defined,
      // return the targetRef of that SequenceFlow.
      const gatewayHasDefaultSequenceFlow = this.exclusiveGateway.defaultOutgoingSequenceFlowId !== undefined;
      if (gatewayHasDefaultSequenceFlow) {

        const defaultSequenceFlow = sequenceFlows.find((flow: Model.ProcessElements.SequenceFlow): boolean => {
          return flow.id === this.exclusiveGateway.defaultOutgoingSequenceFlowId;
        });

        return defaultSequenceFlow.targetRef;
      }

      // If no SequenceFlows have a truthy condition and no default SequenceFlow exists,
      // throw an error
      const noSequenceFlowFoundError =
        new BadRequestError(`No outgoing SequenceFlow for ExclusiveGateway ${this.exclusiveGateway.id} had a truthy condition!`);

      await this.persistOnError(token, noSequenceFlowFoundError);
      throw noSequenceFlowFoundError;
    }

    const tooManyTruthySequenceFlowsExist = truthySequenceFlows.length > 1;
    if (tooManyTruthySequenceFlowsExist) {

      const tooManySequenceFlowsError =
        new BadRequestError(`More than one outgoing SequenceFlow for ExclusiveGateway ${this.exclusiveGateway.id} had a truthy condition!`);

      await this.persistOnError(token, tooManySequenceFlowsError);
      throw tooManySequenceFlowsError;
    }

    const nextFlowNodeRef = truthySequenceFlows[0].targetRef;

    return nextFlowNodeRef;
  }

  private async getSequenceFlowsWithMatchingCondition(
    sequenceFlows: Array<Model.ProcessElements.SequenceFlow>,
    processTokenFacade: IProcessTokenFacade,
  ): Promise<Array<Model.ProcessElements.SequenceFlow>> {

    const truthySequenceFlows: Array<Model.ProcessElements.SequenceFlow> = [];

    for (const sequenceFlow of sequenceFlows) {

      // The default Flow must not be conditional.
      // Thus, it must not be included with the condition evaluations.
      const sequenceFlowIsDefaultFlow = sequenceFlow.id === this.exclusiveGateway.defaultOutgoingSequenceFlowId;

      const sequenceFlowHasNoCondition = sequenceFlow.conditionExpression === undefined;

      if (sequenceFlowHasNoCondition || sequenceFlowIsDefaultFlow) {
        continue;
      }

      const conditionIsFulfilled = await this.executeCondition(sequenceFlow.conditionExpression.expression, processTokenFacade);

      if (conditionIsFulfilled) {
        truthySequenceFlows.push(sequenceFlow);
      }
    }

    return truthySequenceFlows;
  }

  private async executeCondition(condition: string, processTokenFacade: IProcessTokenFacade): Promise<boolean> {
    const tokenData = processTokenFacade.getOldTokenFormat();

    try {
      const functionString = `return ${condition}`;
      const evaluateFunction = new Function('token', functionString);

      return evaluateFunction.call(tokenData, tokenData);

    } catch (err) {
      return false;
    }
  }

}
