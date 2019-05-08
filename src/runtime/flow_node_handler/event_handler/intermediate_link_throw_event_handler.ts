import {Logger} from 'loggerhythm';

import {BadRequestError, NotFoundError} from '@essential-projects/errors_ts';
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

export class IntermediateLinkThrowEventHandler extends EventHandler<Model.Events.IntermediateCatchEvent> {

  constructor(
    eventAggregator: IEventAggregator,
    flowNodeHandlerFactory: IFlowNodeHandlerFactory,
    flowNodePersistenceFacade: IFlowNodePersistenceFacade,
    linkThrowEventModel: Model.Events.IntermediateCatchEvent,
  ) {
    super(eventAggregator, flowNodeHandlerFactory, flowNodePersistenceFacade, linkThrowEventModel);
    this.logger = Logger.createLogger(`processengine:link_throw_event_handler:${linkThrowEventModel.id}`);
  }

  private get linkThrowEventModel(): Model.Events.IntermediateCatchEvent {
    return this.flowNode;
  }

  protected async executeInternally(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing LinkThrowEvent instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this.executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async executeHandler(
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
  ): Promise<Array<Model.Base.FlowNode>> {

    const matchingCatchEvents = processModelFacade.getLinkCatchEventsByLinkName(this.linkThrowEventModel.linkEventDefinition.name);
    const matchingCatchEvent = await this.getMatchingCatchEvent(token, matchingCatchEvents);

    // LinkEvents basically work like SequenceFlows, in that they do nothing but direct
    // the ProcessInstance to another FlowNode.
    // So we can just return the retrieved CatchEvent as a next FlowNode and exit.
    processTokenFacade.addResultForFlowNode(this.linkThrowEventModel.id, this.flowNodeInstanceId, {});
    await this.persistOnExit(token);

    return [matchingCatchEvent];
  }

  private async getMatchingCatchEvent(
    token: ProcessToken,
    events: Array<Model.Events.IntermediateCatchEvent>,
  ): Promise<Model.Events.IntermediateCatchEvent> {

    const noMatchingLinkCatchEventExists = !events || events.length === 0;
    if (noMatchingLinkCatchEventExists) {
      const errorMessage = `No IntermediateCatchEvent with a link called '${this.linkThrowEventModel.linkEventDefinition.name}' exists!`;
      this.logger.error(errorMessage);

      const notFoundError = new NotFoundError(errorMessage);
      await this.persistOnError(token, notFoundError);

      throw notFoundError;
    }

    // By BPMN Specs, all IntermediateLinkCatchEvents must have unique link names.
    // So if multiple links with the same name exist, it constitutes an invalid process model.
    const tooManyMatchingLinkCatchEvents = events.length > 1;
    if (tooManyMatchingLinkCatchEvents) {
      const errorMessage = `Too many CatchEvents for link '${this.linkThrowEventModel.linkEventDefinition.name}' exist!`;
      this.logger.error(errorMessage);

      const notFoundError = new BadRequestError(errorMessage);
      await this.persistOnError(token, notFoundError);

      throw notFoundError;
    }

    return events[0];
  }

}
