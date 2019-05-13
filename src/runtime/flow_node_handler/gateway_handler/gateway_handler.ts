import {InternalServerError} from '@essential-projects/errors_ts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {
  FlowNodeInstance,
  FlowNodeInstanceState,
  ProcessToken,
  ProcessTokenType,
} from '@process-engine/flow_node_instance.contracts';
import {
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

    return new Promise<void>(async (resolve: Function, reject: Function): Promise<void> => {
      try {
        this.previousFlowNodeInstanceId = previousFlowNodeInstanceId;
        token.flowNodeInstanceId = this.flowNodeInstanceId;

        this.terminationSubscription = this.subscribeToProcessTermination(token, reject);

        await this.beforeExecute(token, processTokenFacade, processModelFacade, identity);
        const nextFlowNodes = await this.executeInternally(token, processTokenFacade, processModelFacade, identity);
        await this.afterExecute(token, processTokenFacade, processModelFacade, identity);

        const nextFlowNodesFound = nextFlowNodes && nextFlowNodes.length > 0;
        if (nextFlowNodesFound) {

          const executeNextFlowNode = async (nextFlowNode: Model.Base.FlowNode): Promise<void> => {
            const nextFlowNodeHandler = await this.flowNodeHandlerFactory.create<Model.Base.FlowNode>(nextFlowNode, token);

            // If we must execute multiple branches, then each branch must get its own ProcessToken and Facade.
            const tokenForNextFlowNode = nextFlowNodes.length > 1
              ? processTokenFacade.createProcessToken(token.payload)
              : token;

            const processTokenFacadeForFlowNode = nextFlowNodes.length > 1
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

        const allResults = processTokenFacade.getAllResults();
        // This check is necessary to prevent duplicate entries, in case the Promise-Chain was broken further down the road.
        const noResultStoredYet = !allResults.some((entry: IFlowNodeInstanceResult): boolean => entry.flowNodeInstanceId === this.flowNodeInstanceId);
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

    return new Promise<void>(async (resolve: Function, reject: Function): Promise<void> => {
      try {
        const flowNodeInstance = flowNodeInstances.find((instance: FlowNodeInstance): boolean => instance.flowNodeId === this.flowNode.id);

        this.previousFlowNodeInstanceId = flowNodeInstance.previousFlowNodeInstanceId;
        this.flowNodeInstanceId = flowNodeInstance.id;

        // It doesn't really matter which token is used here, since payload-specific operations should
        // only ever be done during the handlers execution.
        // We only require the token here, so that we can pass infos like ProcessInstanceId or CorrelationId to the hook.
        const tokenForHandlerHooks = flowNodeInstance.tokens[0];

        await this.beforeExecute(tokenForHandlerHooks, processTokenFacade, processModelFacade, identity);

        this.terminationSubscription = this.subscribeToProcessTermination(tokenForHandlerHooks, reject);

        // With regards to ParallelGateways, we need to be able to handle multiple results here.
        const nextFlowNodes = await this.resumeInternally(flowNodeInstance, processTokenFacade, processModelFacade, identity);

        await this.afterExecute(tokenForHandlerHooks, processTokenFacade, processModelFacade, identity);

        const nextFlowNodesFound = nextFlowNodes && nextFlowNodes.length > 0;
        if (nextFlowNodesFound) {

          const currentResult = processTokenFacade
            .getAllResults()
            .pop();

          const handleNextFlowNode = async (nextFlowNode: Model.Base.FlowNode): Promise<void> => {
            const processToken = processTokenFacade.createProcessToken(currentResult.result);

            const nextFlowNodeHandler = await this.flowNodeHandlerFactory.create<Model.Base.FlowNode>(nextFlowNode, processToken);

            const nextFlowNodeInstance = flowNodeInstances.find((instance: FlowNodeInstance): boolean => instance.flowNodeId === nextFlowNode.id);

            processToken.flowNodeInstanceId = nextFlowNodeInstance
              ? nextFlowNodeInstance.id
              : nextFlowNodeHandler.getInstanceId();

            // If we must execute multiple branches, then each branch must get its own ProcessToken and Facade.
            const tokenForNextFlowNode = nextFlowNodes.length > 1
              ? processTokenFacade.createProcessToken(processToken.payload)
              : processToken;

            const processTokenFacadeForFlowNode = nextFlowNodes.length > 1
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

        const token = processTokenFacade.createProcessToken();
        token.payload = error;
        token.flowNodeInstanceId = this.flowNodeInstanceId;

        // This check is necessary to prevent duplicate entries, in case the Promise-Chain was broken further down the road.
        const allResults = processTokenFacade.getAllResults();

        const noResultStoredYet = !allResults.some((entry: IFlowNodeInstanceResult): boolean => entry.flowNodeInstanceId === this.flowNodeInstanceId);
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

        this.logger.verbose('Resuming FlowNodeInstance.');
        const onEnterToken = flowNodeInstance.getTokenByType(ProcessTokenType.onEnter);

        return this.continueAfterEnter(onEnterToken, processTokenFacade, processModelFacade, identity);

      case FlowNodeInstanceState.finished:
        this.logger.verbose('FlowNodeInstance was already finished. Skipping ahead.');
        const onExitToken = flowNodeInstance.getTokenByType(ProcessTokenType.onExit);

        return this.continueAfterExit(onExitToken, processTokenFacade, processModelFacade, identity);

      case FlowNodeInstanceState.error:
        this.logger.error(
          `Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because it previously exited with an error!`,
          flowNodeInstance.error,
        );
        throw flowNodeInstance.error;

      case FlowNodeInstanceState.terminated:
        const terminatedError = `Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because it was terminated!`;
        this.logger.error(terminatedError);
        throw new InternalServerError(terminatedError);

      default:
        const invalidStateError = `Cannot resume FlowNodeInstance ${flowNodeInstance.id}, because its state cannot be determined!`;
        this.logger.error(invalidStateError);
        throw new InternalServerError(invalidStateError);
    }
  }

}
