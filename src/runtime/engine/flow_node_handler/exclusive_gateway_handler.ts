import {Logger} from 'loggerhythm';

import {BadRequestError, UnprocessableEntityError} from '@essential-projects/errors_ts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoggingApi} from '@process-engine/logging_api_contracts';
import {IMetricsApi} from '@process-engine/metrics_api_contracts';
import {
  IFlowNodeInstanceService,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  NextFlowNodeInfo,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './index';

export class ExclusiveGatewayHandler extends FlowNodeHandler<Model.Gateways.ExclusiveGateway> {

  constructor(flowNodeInstanceService: IFlowNodeInstanceService,
              loggingApiService: ILoggingApi,
              metricsService: IMetricsApi,
              exclusiveGatewayModel: Model.Gateways.ExclusiveGateway) {
    super(flowNodeInstanceService, loggingApiService, metricsService, exclusiveGatewayModel);
    this.logger = new Logger(`processengine:exclusive_gateway_handler:${exclusiveGatewayModel.id}`);
  }

  private get exclusiveGateway(): Model.Gateways.ExclusiveGateway {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Executing ExclusiveGateway instance ${this.flowNodeInstanceId}`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async _continueAfterExit(onExitToken: Runtime.Types.ProcessToken,
                                     processTokenFacade: IProcessTokenFacade,
                                     processModelFacade: IProcessModelFacade,
                                    ): Promise<NextFlowNodeInfo> {

    processTokenFacade.addResultForFlowNode(this.exclusiveGateway.id, onExitToken.payload);

    const isExclusiveJoinGateway: boolean = this.exclusiveGateway.gatewayDirection === Model.Gateways.GatewayDirection.Converging;
    if (isExclusiveJoinGateway) {
      return this.getNextFlowNodeInfo(onExitToken, processTokenFacade, processModelFacade);
    }

    const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getOutgoingSequenceFlowsFor(this.exclusiveGateway.id);

    // Since the Gateway was finished without error, we can assume that only one outgoing SequenceFlow with a matching condition exists.
    // If this were not the case, the Gateway would not have been executed at all.
    const matchingSequenceFlows: Array<Model.Types.SequenceFlow> =
      await this._getSequenceFlowsWithMatchingCondition(outgoingSequenceFlows, processTokenFacade);

    const nextFlowNodeAfterSplit: Model.Base.FlowNode = processModelFacade.getFlowNodeById(matchingSequenceFlows[0].targetRef);

    return new NextFlowNodeInfo(nextFlowNodeAfterSplit, onExitToken, processTokenFacade);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade): Promise<NextFlowNodeInfo> {

    const gatewayTypeIsNotSupported: boolean =
      this.exclusiveGateway.gatewayDirection === Model.Gateways.GatewayDirection.Unspecified ||
      this.exclusiveGateway.gatewayDirection === Model.Gateways.GatewayDirection.Mixed;

    if (gatewayTypeIsNotSupported) {
      const unsupportedErrorMessage: string =
        `ExclusiveGateway ${this.exclusiveGateway.id} is neither a Split- nor a Join-Gateway! Mixed Gateways are NOT supported!`;
      const unsupportedError: UnprocessableEntityError = new UnprocessableEntityError(unsupportedErrorMessage);

      this.persistOnError(token, unsupportedError);

      throw unsupportedError;
    }

    processTokenFacade.addResultForFlowNode(this.exclusiveGateway.id, token.payload);

    const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getOutgoingSequenceFlowsFor(this.exclusiveGateway.id);

    const isExclusiveJoinGateway: boolean = this.exclusiveGateway.gatewayDirection === Model.Gateways.GatewayDirection.Converging;

    if (isExclusiveJoinGateway) {

      // If this is a join gateway, just return the next FlowNode to execute.
      // Prerequisite for this UseCase is that only one outgoing SequenceFlow exists here.
      const nextFlowNodeAfterJoin: Model.Base.FlowNode = processModelFacade.getFlowNodeById(outgoingSequenceFlows[0].targetRef);

      await this.persistOnExit(token);

      return new NextFlowNodeInfo(nextFlowNodeAfterJoin, token, processTokenFacade);
    }

    // If this is a split gateway, find the SequenceFlow that has a truthy condition
    // and continue execution with its target FlowNode.
    const nextFlowNodeId: string = await this.determineBranchToTake(token, outgoingSequenceFlows, processTokenFacade);
    await this.persistOnExit(token);

    const nextFlowNodeAfterSplit: Model.Base.FlowNode = processModelFacade.getFlowNodeById(nextFlowNodeId);

    return new NextFlowNodeInfo(nextFlowNodeAfterSplit, token, processTokenFacade);
  }

  private async determineBranchToTake(
    token: Runtime.Types.ProcessToken,
    sequenceFlows: Array<Model.Types.SequenceFlow>,
    processTokenFacade: IProcessTokenFacade,
  ): Promise<string> {

    const truthySequenceFlows: Array<Model.Types.SequenceFlow> = await this._getSequenceFlowsWithMatchingCondition(sequenceFlows, processTokenFacade);

    const noTruthySequenceFlowsExist: boolean = truthySequenceFlows.length === 0;
    if (noTruthySequenceFlowsExist) {

      const noSequenceFlowFoundError: BadRequestError =
        new BadRequestError(`No outgoing SequenceFlow for ExclusiveGateway ${this.exclusiveGateway.id} had a truthy condition!`);

      await this.persistOnError(token, noSequenceFlowFoundError);
      throw noSequenceFlowFoundError;
    }

    const tooManyTruthySequenceFlowsExist: boolean = truthySequenceFlows.length > 1;
    if (tooManyTruthySequenceFlowsExist) {

      const tooManySequenceFlowsError: BadRequestError =
        new BadRequestError(`More than one outgoing SequenceFlow for ExclusiveGateway ${this.exclusiveGateway.id} had a truthy condition!`);

      await this.persistOnError(token, tooManySequenceFlowsError);
      throw tooManySequenceFlowsError;
    }

    const nextFlowNodeRef: string = truthySequenceFlows[0].targetRef;

    return nextFlowNodeRef;
  }

  private async _getSequenceFlowsWithMatchingCondition(
    sequenceFlows: Array<Model.Types.SequenceFlow>,
    processTokenFacade: IProcessTokenFacade,
  ): Promise<Array<Model.Types.SequenceFlow>> {

    const truthySequenceFlows: Array<Model.Types.SequenceFlow> = [];

    for (const sequenceFlow of sequenceFlows) {

      const sequenceFlowHasNoCondition: boolean = sequenceFlow.conditionExpression === undefined || sequenceFlow.conditionExpression === null;
      if (sequenceFlowHasNoCondition) {
        continue;
      }

      const conditionIsFulfilled: boolean = await this.executeCondition(sequenceFlow.conditionExpression.expression, processTokenFacade);

      if (conditionIsFulfilled) {
        truthySequenceFlows.push(sequenceFlow);
      }
    }

    return truthySequenceFlows;
  }

  private async executeCondition(condition: string, processTokenFacade: IProcessTokenFacade): Promise<boolean> {
    const tokenData: any = await processTokenFacade.getOldTokenFormat();

    try {
      const functionString: string = `return ${condition}`;
      const evaluateFunction: Function = new Function('token', functionString);

      return evaluateFunction.call(tokenData, tokenData);

    } catch (err) {
      return false;
    }
  }
}
