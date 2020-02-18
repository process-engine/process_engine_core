import * as AsyncLock from 'async-lock';
import * as Bluebird from 'bluebird';

import {InternalServerError, UnprocessableEntityError} from '@essential-projects/errors_ts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {
  FlowNodeInstance,
  FlowNodeInstanceState,
  Model,
  ProcessToken,
  ProcessTokenType,
} from '@process-engine/persistence_api.contracts';
import {
  IProcessModelFacade,
  IProcessTokenFacade,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from '../flow_node_handler';

const lock = new AsyncLock({Promise: Bluebird});

export abstract class GatewayHandler<TFlowNode extends Model.Gateways.Gateway> extends FlowNodeHandler<TFlowNode> {

  protected async beforeExecute(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    rejectFunction?: Function,
  ): Promise<void> {
    await super.beforeExecute(token, processTokenFacade, processModelFacade, identity);
    this.terminationSubscription = this.subscribeToProcessTermination(token, rejectFunction);
    this.processErrorSubscription = this.subscribeToProcessError(token, rejectFunction);
  }

  public async execute(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
    previousFlowNodeInstanceId?: string,
  ): Promise<void> {

    return new Promise<void>(async (resolve: Function, reject: Function): Promise<void> => {

      const gatewayTypeIsNotSupported =
        this.flowNode.gatewayDirection === Model.Gateways.GatewayDirection.Unspecified ||
        this.flowNode.gatewayDirection === Model.Gateways.GatewayDirection.Mixed;

      if (gatewayTypeIsNotSupported) {
        const unsupportedErrorMessage = `Gateway ${this.flowNode.id} is neither a Split- nor a Join-Gateway! Mixed Gateways are NOT supported!`;
        const unsupportedError = new UnprocessableEntityError(unsupportedErrorMessage);

        this.logger.error(unsupportedErrorMessage);
        this.persistOnError(token, unsupportedError);

        return reject(unsupportedError);
      }

      this.previousFlowNodeInstanceId = previousFlowNodeInstanceId;
      token.flowNodeInstanceId = this.flowNodeInstanceId;

      const laneContainingCurrentFlowNode = processModelFacade.getLaneForFlowNode(this.flowNode.id);
      if (laneContainingCurrentFlowNode != undefined) {
        token.currentLane = laneContainingCurrentFlowNode.name;
      }

      try {
        let nextFlowNodes: Array<Model.Base.FlowNode>;
        await lock.acquire<Array<Model.Base.FlowNode>>(this.flowNodeInstanceId, async () => {
          await this.beforeExecute(token, processTokenFacade, processModelFacade, identity, reject);
          nextFlowNodes = await this.startExecution(token, processTokenFacade, processModelFacade, identity);
          await this.afterExecute(token, processTokenFacade, processModelFacade, identity);
        });

        const processIsNotYetFinished = nextFlowNodes?.length > 0;
        if (processIsNotYetFinished) {

          const nextFlowNodeExecutionPromises: Array<Promise<void>> = [];

          for (const nextFlowNode of nextFlowNodes) {

            // If we must execute multiple branches, then each branch must get its own ProcessToken and Facade.
            const processTokenForBranch = nextFlowNodes.length > 1
              ? processTokenFacade.createProcessToken(token.payload)
              : token;

            const processTokenFacadeForFlowNode = nextFlowNodes.length > 1
              ? processTokenFacade.getProcessTokenFacadeForParallelBranch()
              : processTokenFacade;

            const handleNextFlowNodePromise = this.handleNextFlowNode(
              nextFlowNode,
              processTokenFacadeForFlowNode,
              processModelFacade,
              processTokenForBranch,
              identity,
            );
            nextFlowNodeExecutionPromises.push(handleNextFlowNodePromise);
          }

          await Promise.all(nextFlowNodeExecutionPromises);
        }

        return resolve();
      } catch (error) {
        return this.handleError(token, error, processTokenFacade, reject);
      }
    });
  }

  public async resume(
    flowNodeInstanceForHandler: FlowNodeInstance,
    allFlowNodeInstances: Array<FlowNodeInstance>,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<void> {

    return new Promise<void>(async (resolve: Function, reject: Function): Promise<void> => {

      this.previousFlowNodeInstanceId = flowNodeInstanceForHandler.previousFlowNodeInstanceId;
      this.flowNodeInstanceId = flowNodeInstanceForHandler.id;

      // It doesn't really matter which token is used here, since payload-specific operations should
      // only ever be done during the handler's execution.
      // We only require the token here, so that we can pass infos like ProcessInstanceId or CorrelationId to the hook.
      const token = flowNodeInstanceForHandler.tokens[0];

      try {
        let nextFlowNodes: Array<Model.Base.FlowNode>;
        await lock.acquire<Array<Model.Base.FlowNode>>(this.flowNodeInstanceId, async () => {
          await this.beforeExecute(token, processTokenFacade, processModelFacade, identity, reject);
          nextFlowNodes = await this.resumeFromState(flowNodeInstanceForHandler, processTokenFacade, processModelFacade, identity);
          await this.afterExecute(token, processTokenFacade, processModelFacade, identity);
        });

        const processIsNotYetFinished = nextFlowNodes?.length > 0;
        if (processIsNotYetFinished) {

          const currentResult = processTokenFacade
            .getAllResults()
            .pop();

          const nextFlowNodeExecutionPromises: Array<Promise<void>> = [];

          for (const nextFlowNode of nextFlowNodes) {

            const processTokenForBranch = nextFlowNodes.length > 1
              ? processTokenFacade.createProcessToken(currentResult)
              : token;

            const processTokenFacadeForFlowNode = nextFlowNodes.length > 1
              ? processTokenFacade.getProcessTokenFacadeForParallelBranch()
              : processTokenFacade;

            const nextFlowNodeInstance = this.findNextInstanceOfFlowNode(allFlowNodeInstances, nextFlowNode.id);

            const handleNextFlowNodePromise = this.handleNextFlowNode(
              nextFlowNode,
              processTokenFacadeForFlowNode,
              processModelFacade,
              processTokenForBranch,
              identity,
              nextFlowNodeInstance,
              allFlowNodeInstances,
            );
            nextFlowNodeExecutionPromises.push(handleNextFlowNodePromise);
          }

          await Promise.all(nextFlowNodeExecutionPromises);
        }

        return resolve();
      } catch (error) {
        return this.handleError(token, error, processTokenFacade, reject);
      }
    });
  }

  protected async resumeFromState(
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
