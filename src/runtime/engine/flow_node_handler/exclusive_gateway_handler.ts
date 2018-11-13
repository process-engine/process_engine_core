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

  constructor(flowNodeInstanceService: IFlowNodeInstanceService, loggingApiService: ILoggingApi, metricsService: IMetricsApi) {
    super(flowNodeInstanceService, loggingApiService, metricsService);
  }

  protected async executeInternally(exclusiveGateway: Model.Gateways.ExclusiveGateway,
                                    token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(exclusiveGateway, token);

    const gatewayTypeIsNotSupported: boolean =
      exclusiveGateway.gatewayDirection === Model.Gateways.GatewayDirection.Unspecified ||
      exclusiveGateway.gatewayDirection === Model.Gateways.GatewayDirection.Mixed;

    if (gatewayTypeIsNotSupported) {
      const unsupportedErrorMessage: string =
        `ExclusiveGateway ${exclusiveGateway.id} is neither a Split- nor a Join-Gateway! Mixed Gateways are NOT supported!`;
      const unsupportedError: UnprocessableEntityError = new UnprocessableEntityError(unsupportedErrorMessage);

      this.persistOnError(exclusiveGateway, token, unsupportedError);

      throw unsupportedError;
    }

    const currentToken: any = await processTokenFacade.getOldTokenFormat();
    processTokenFacade.addResultForFlowNode(exclusiveGateway.id, currentToken.current);

    const outgoingSequenceFlows: Array<Model.Types.SequenceFlow> = processModelFacade.getOutgoingSequenceFlowsFor(exclusiveGateway.id);

    const isExclusiveJoinGateway: boolean = exclusiveGateway.gatewayDirection === Model.Gateways.GatewayDirection.Converging;

    if (isExclusiveJoinGateway) {

      // If this is a join gateway, just return the next FlowNode to execute.
      // Prerequisite for this UseCase is that only one outgoing SequenceFlow exists here.
      const nextFlowNodeAfterJoin: Model.Base.FlowNode = processModelFacade.getFlowNodeById(outgoingSequenceFlows[0].targetRef);

      await this.persistOnExit(exclusiveGateway, token);

      return new NextFlowNodeInfo(nextFlowNodeAfterJoin, token, processTokenFacade);
    }

    // If this is a split gateway, find the SequenceFlow that has a truthy condition
    // and continue execution with its target FlowNode.
    const nextFlowNodeId: string = await this.determineBranchToTake(exclusiveGateway.id, outgoingSequenceFlows, processTokenFacade);

    const nextFlowNodeAfterSplit: Model.Base.FlowNode = processModelFacade.getFlowNodeById(nextFlowNodeId);

    await this.persistOnExit(exclusiveGateway, token);

    return new NextFlowNodeInfo(nextFlowNodeAfterSplit, token, processTokenFacade);
  }

  private async determineBranchToTake(
    exclusiveGatewayId: string,
    sequenceFlows: Array<Model.Types.SequenceFlow>,
    processTokenFacade: IProcessTokenFacade,
  ): Promise<string> {

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

    const noTruthySequenceFlowsExist: boolean = truthySequenceFlows.length === 0;
    if (noTruthySequenceFlowsExist) {
      throw new BadRequestError(`No outgoing SequenceFlow for ExclusiveGateway ${exclusiveGatewayId} had a truthy condition!`);
    }

    const tooManyTruthySequenceFlowsExist: boolean = truthySequenceFlows.length > 1;
    if (tooManyTruthySequenceFlowsExist) {
      throw new BadRequestError(`More than one outgoing SequenceFlow for ExclusiveGateway ${exclusiveGatewayId} had a truthy condition!`);
    }

    const nextFlowNodeRef: string = truthySequenceFlows[0].targetRef;

    return nextFlowNodeRef;
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
