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
  }

  private get exclusiveGateway(): Model.Gateways.ExclusiveGateway {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade);
  }

  public async resumeInternally(flowNodeInstance: Runtime.Types.FlowNodeInstance,
                                processTokenFacade: IProcessTokenFacade,
                                processModelFacade: IProcessModelFacade,
                                identity: IIdentity,
                              ): Promise<NextFlowNodeInfo> {

    // ExclusiveGateways only produce two tokens in their lifetime.
    // Therefore, it is safe to assume that only one token exists at this point.
    const onEnterToken: Runtime.Types.ProcessToken = flowNodeInstance.tokens[0];

    return this._executeHandler(onEnterToken, processTokenFacade, processModelFacade);
  }

  private async _executeHandler(token: Runtime.Types.ProcessToken,
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

    const currentToken: any = await processTokenFacade.getOldTokenFormat();
    processTokenFacade.addResultForFlowNode(this.exclusiveGateway.id, currentToken.current);

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
