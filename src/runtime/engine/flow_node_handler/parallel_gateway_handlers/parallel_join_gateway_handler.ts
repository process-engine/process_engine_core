import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';

import {IIdentity} from '@essential-projects/iam_contracts';
import {
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from '../index';

export class ParallelJoinGatewayHandler extends FlowNodeHandler<Model.Gateways.ParallelGateway> {

  // State Flag, which will determine how the GatewayHandler will deal with calls to "executeInternally".
  private _waitingForIncomingFlows: boolean = false;

  constructor(container: IContainer, parallelGatewayModel: Model.Gateways.ParallelGateway) {
    super(container, parallelGatewayModel);
    this.logger = Logger.createLogger(`processengine:parallel_join_gateway:${parallelGatewayModel.id}`);
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    if (this._waitingForIncomingFlows) {
      // TODO: If the Handler is already listening for incoming FlowNodeInstances,
      // add the ID of the previous FlowNodeInstance to the list of received branches.
      // If enough branches have been received, continue with the Promise-Chain.
    } else {
      // TODO: If this is the first time the handler is run, initialize the Promise that waits for
      // all the branches to arrive.
      this.logger.verbose(`Executing ParallelJoinGateway instance ${this.flowNodeInstanceId}.`);
      await this.persistOnEnter(token);

      this._waitingForIncomingFlows = true;

      return await this._executeHandler(token, processTokenFacade, processModelFacade, identity);
    }
  }

  protected async _executeHandler(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {
    // --------------------------------
    // TODO - WIP
    // --------------------------------

    await this.persistOnExit(token);
    processTokenFacade.addResultForFlowNode(this.flowNode.id, token.payload);

    return processModelFacade.getNextFlowNodesFor(this.flowNode);
  }
}
