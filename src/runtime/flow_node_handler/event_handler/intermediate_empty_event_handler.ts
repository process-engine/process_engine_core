import {Logger} from 'loggerhythm';

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

import {EventHandler} from './index';

export class IntermediateEmptyEventHandler extends EventHandler<Model.Events.IntermediateCatchEvent> {

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    emptyEventModel: Model.Events.IntermediateCatchEvent,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, emptyEventModel);
    this.logger = Logger.createLogger(`processengine:empty_event_handler:${emptyEventModel.id}`);
  }

  private get emptyEventModel(): Model.Events.IntermediateCatchEvent {
    return super.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing EmptyEvent instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this.executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    // This type of FlowNode works pretty much like a regular StartEvent, except that it is called mid-process.
    processTokenFacade.addResultForFlowNode(this.emptyEventModel.id, this.flowNodeInstanceId, token.payload);
    await this.persistOnExit(token);

    return processModelFacade.getNextFlowNodesFor(this.emptyEventModel);
  }

}
