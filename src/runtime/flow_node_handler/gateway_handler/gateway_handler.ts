import {InternalServerError} from '@essential-projects/errors_ts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {FlowNodeInstance, FlowNodeInstanceState, ProcessToken, ProcessTokenType} from '@process-engine/flow_node_instance.contracts';
import {
  IFlowNodeHandler,
  IFlowNodeInstanceResult,
  IProcessModelFacade,
  IProcessTokenFacade,
} from '@process-engine/process_engine_contracts';
import {Model} from '@process-engine/process_model.contracts';

import {FlowNodeHandler} from '../flow_node_handler';

export abstract class GatewayHandler<TFlowNode extends Model.Base.FlowNode> extends FlowNodeHandler<TFlowNode> {

  public async execute(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    previousFlowNodeInstanceId?: string,
  ): Promise<void> {

    return new Promise<void>(async(resolve: Function, reject: Function): Promise<void> => {
      try {
        this._previousFlowNodeInstanceId = previousFlowNodeInstanceId;
        token.flowNodeInstanceId = this.flowNodeInstanceId;
        let nextFlowNodes: Array<Model.Base.FlowNode>;

        this._terminationSubscription = this.subscribeToProcessTermination(token, reject);

        await this.beforeExecute(token, processTokenFacade, processModelFacade, identity);
        nextFlowNodes = await this.executeInternally(token, processTokenFacade, processModelFacade, identity);
        await this.afterExecute(token, processTokenFacade, processModelFacade, identity);

        const nextFlowNodesFound: boolean = nextFlowNodes && nextFlowNodes.length > 0;
        if (nextFlowNodesFound) {

          const executeNextFlowNode: Function = async(nextFlowNode: Model.Base.FlowNode): Promise<void> => {
            const nextFlowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> =
              await this.flowNodeHandlerFactory.create<Model.Base.FlowNode>(nextFlowNode, token);

            // If we must execute multiple branches, then each branch must get its own ProcessToken and Facade.
            const tokenForNextFlowNode: ProcessToken = nextFlowNodes.length > 1
              ? processTokenFacade.createProcessToken(token.payload)
              : token;

            const processTokenFacadeForFlowNode: IProcessTokenFacade = nextFlowNodes.length > 1
              ? processTokenFacade.getProcessTokenFacadeForParallelBranch()
              : processTokenFacade;

            tokenForNextFlowNode.flowNodeInstanceId = nextFlowNodeHandler.getInstanceId();

            return nextFlowNodeHandler
              .execute(tokenForNextFlowNode, processTokenFacadeForFlowNode, processModelFacade, identity, this.flowNodeInstanceId);
          };

          const nextFlowNodeExecutionPromises: Array<Promise<void>> = [];
          for (const nextFlowNode of nextFlowNodes) {
            nextFlowNodeExecutionPromises.push(executeNextFlowNode(nextFlowNode));
          }

          await Promise.all(nextFlowNodeExecutionPromises);
        }

        return resolve();
      } catch (error) {

        token.payload = error;

        const allResults: Array<IFlowNodeInstanceResult> = processTokenFacade.getAllResults();
        // This check is necessary to prevent duplicate entries, in case the Promise-Chain was broken further down the road.
        const noResultStoredYet: boolean = !allResults.some((entry: IFlowNodeInstanceResult) => entry.flowNodeInstanceId === this.flowNodeInstanceId);
        if (noResultStoredYet) {
          processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, error);
        }

        await this.afterExecute(token);

        return reject(error);
      }
    });
  }

  public async resume(
    flowNodeInstances: Array<FlowNodeInstance>,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {

    return new Promise<void>(async(resolve: Function, reject: Function): Promise<void> => {
      try {
        const flowNodeInstance: FlowNodeInstance =
          flowNodeInstances.find((instance: FlowNodeInstance) => instance.flowNodeId === this.flowNode.id);

        this._previousFlowNodeInstanceId = flowNodeInstance.previousFlowNodeInstanceId;
        this._flowNodeInstanceId = flowNodeInstance.id;

        // With regards to ParallelGateways, we need to be able to handle multiple results here.
        let nextFlowNodes: Array<Model.Base.FlowNode>;

        // It doesn't really matter which token is used here, since payload-specific operations should
        // only ever be done during the handlers execution.
        // We only require the token here, so that we can pass infos like ProcessInstanceId or CorrelationId to the hook.
        const tokenForHandlerHooks: ProcessToken = flowNodeInstance.tokens[0];

        await this.beforeExecute(tokenForHandlerHooks, processTokenFacade, processModelFacade, identity);

        this._terminationSubscription = this.subscribeToProcessTermination(tokenForHandlerHooks, reject);

        nextFlowNodes = await this.resumeInternally(flowNodeInstance, processTokenFacade, processModelFacade, identity);

        await this.afterExecute(tokenForHandlerHooks, processTokenFacade, processModelFacade, identity);

        const nextFlowNodesFound: boolean = nextFlowNodes && nextFlowNodes.length > 0;
        if (nextFlowNodesFound) {

          const currentResult: IFlowNodeInstanceResult = processTokenFacade
            .getAllResults()
            .pop();

          const handleNextFlowNode: Function = async(nextFlowNode: Model.Base.FlowNode): Promise<void> => {
            const processToken: ProcessToken = processTokenFacade.createProcessToken(currentResult.result);

            const nextFlowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> =
              await this.flowNodeHandlerFactory.create<Model.Base.FlowNode>(nextFlowNode, processToken);

            const nextFlowNodeInstance: FlowNodeInstance =
              flowNodeInstances.find((instance: FlowNodeInstance) => instance.flowNodeId === nextFlowNode.id);

            processToken.flowNodeInstanceId = nextFlowNodeInstance
              ? nextFlowNodeInstance.id
              : nextFlowNodeHandler.getInstanceId();

            // If we must execute multiple branches, then each branch must get its own ProcessToken and Facade.
            const tokenForNextFlowNode: ProcessToken = nextFlowNodes.length > 1
              ? processTokenFacade.createProcessToken(processToken.payload)
              : processToken;

            const processTokenFacadeForFlowNode: IProcessTokenFacade = nextFlowNodes.length > 1
              ? processTokenFacade.getProcessTokenFacadeForParallelBranch()
              : processTokenFacade;

            // An instance for the next FlowNode has already been created. Continue resuming
            if (nextFlowNodeInstance) {
              return nextFlowNodeHandler.resume(flowNodeInstances, processTokenFacadeForFlowNode, processModelFacade, identity);
            }

            // No instance for the next FlowNode was found.
            // We have arrived at the point at which the ProcessInstance was interrupted and can continue normally.
            return nextFlowNodeHandler
              .execute(tokenForNextFlowNode, processTokenFacadeForFlowNode, processModelFacade, identity, this.flowNodeInstanceId);
          };

          const nextFlowNodeExecutionPromises: Array<Promise<void>> = [];
          for (const nextFlowNode of nextFlowNodes) {
            nextFlowNodeExecutionPromises.push(handleNextFlowNode(nextFlowNode));
          }

          await Promise.all(nextFlowNodeExecutionPromises);
        }

        return resolve();
      } catch (error) {

        const token: ProcessToken = processTokenFacade.createProcessToken();
        token.payload = error;
        token.flowNodeInstanceId = this.flowNodeInstanceId;

        // This check is necessary to prevent duplicate entries, in case the Promise-Chain was broken further down the road.
        const allResults: Array<IFlowNodeInstanceResult> = processTokenFacade.getAllResults();

        const noResultStoredYet: boolean = !allResults.some((entry: IFlowNodeInstanceResult) => entry.flowNodeInstanceId === this.flowNodeInstanceId);
        if (noResultStoredYet) {
          processTokenFacade.addResultForFlowNode(this.flowNode.id, this.flowNodeInstanceId, token);
        }

        await this.afterExecute(token);

        return reject(error);
      }
    });
  }

  protected async resumeInternally(
    flowNodeInstance: FlowNodeInstance,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Resuming FlowNodeInstance ${flowNodeInstance.id}.`);

    switch (flowNodeInstance.state) {

      case FlowNodeInstanceState.running:

        this.logger.verbose(`Resuming FlowNodeInstance.`);
        const onEnterToken: ProcessToken = flowNodeInstance.getTokenByType(ProcessTokenType.onEnter);

        return this._continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade, identity);

      case FlowNodeInstanceState.finished:
        this.logger.verbose(`FlowNodeInstance was already finished. Skipping ahead.`);
        const onExitToken: ProcessToken = flowNodeInstance.getTokenByType(ProcessTokenType.onExit);

        return this._continueAfterExit(onExitToken, processTokenFacade, processModelFacade, identity);

      case FlowNodeInstanceState.error:
        this.logger.error(`Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because it previously exited with an error!`,
                     flowNodeInstance.error);
        throw flowNodeInstance.error;

      case FlowNodeInstanceState.terminated:
        const terminatedError: string = `Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because it was terminated!`;
        this.logger.error(terminatedError);
        throw new InternalServerError(terminatedError);

      default:
        const invalidStateError: string = `Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because its state cannot be determined!`;
        this.logger.error(invalidStateError);
        throw new InternalServerError(invalidStateError);
    }
  }
}
