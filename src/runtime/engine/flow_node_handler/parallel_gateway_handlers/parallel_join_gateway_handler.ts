import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';

import {IIdentity} from '@essential-projects/iam_contracts';
import {
  IProcessModelFacade,
  IProcessTokenFacade,
  IProcessTokenResult,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandlerInterruptible} from '../index';

export class ParallelJoinGatewayHandler extends FlowNodeHandlerInterruptible<Model.Gateways.ParallelGateway> {

  private expectedNumberOfResults: number = -1;
  private receivedResults: Array<IProcessTokenResult> = [];

  private onEnterStatePersisted: boolean = false;

  constructor(container: IContainer, parallelGatewayModel: Model.Gateways.ParallelGateway) {
    super(container, parallelGatewayModel);
    this.logger = Logger.createLogger(`processengine:parallel_join_gateway:${parallelGatewayModel.id}`);
  }

  private get parallelGateway(): Model.Gateways.ParallelGateway {
    return super.flowNode;
  }

  protected async beforeExecute(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<void> {

    await super.beforeExecute(token, processTokenFacade, processModelFacade);

    const expectedResultsAlreadySet: boolean = this.expectedNumberOfResults > -1;
    if (expectedResultsAlreadySet) {
      return;
    }

    const preceedingFlowNodes: Array<Model.Base.FlowNode> = processModelFacade.getPreviousFlowNodesFor(this.parallelGateway);
    this.expectedNumberOfResults = preceedingFlowNodes.length;
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    // We must only store this state change once to prevent duplicate database entries.
    if (!this.onEnterStatePersisted) {
      await this.persistOnEnter(token);
      this.onEnterStatePersisted = true;
    }

    this.logger.verbose(`Executing ParallelJoinGateway instance ${this.flowNodeInstanceId}.`);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _executeHandler(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const latestResult: IProcessTokenResult = this._getLatestFlowNodeResultFromFacade(processTokenFacade);
    this.receivedResults.push(latestResult);

    const notAllBranchesHaveFinished: boolean = this.receivedResults.length < this.expectedNumberOfResults;
    if (notAllBranchesHaveFinished) {
      return undefined;
    }

    const aggregatedResults: any = this._aggregateBranchTokens();

    token.payload = aggregatedResults;

    await this.persistOnExit(token);
    processTokenFacade.addResultForFlowNode(this.flowNode.id, aggregatedResults);

    const nextFlowNodes: Array<Model.Base.FlowNode> = processModelFacade.getNextFlowNodesFor(this.flowNode);

    return nextFlowNodes;
  }

  private _getLatestFlowNodeResultFromFacade(processTokenFacade: IProcessTokenFacade): IProcessTokenResult {
    return processTokenFacade.getAllResults().pop();
  }

  private _aggregateBranchTokens(): any {
    const resultToken: any = {};

    for (const branchResult of this.receivedResults) {
      resultToken[branchResult.flowNodeId] = branchResult.result;
    }

    return resultToken;
  }
}
