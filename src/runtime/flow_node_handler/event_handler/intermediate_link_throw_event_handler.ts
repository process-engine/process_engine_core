import {Logger} from 'loggerhythm';

import {BadRequestError, NotFoundError} from '@essential-projects/errors_ts';
import {IEventAggregator} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {Model, ProcessToken} from '@process-engine/persistence_api.contracts';
import {
  IFlowNodeHandlerFactory,
  IFlowNodePersistenceFacade,
  IProcessModelFacade,
  IProcessTokenFacade,
} from '@process-engine/process_engine_contracts';

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

  protected async startExecution(
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

    const matchingCatchEvent = await this.getMatchingCatchEvent(token, processModelFacade);

    processTokenFacade.addResultForFlowNode(this.linkThrowEventModel.id, this.flowNodeInstanceId, {});

    await this.persistOnExit(token);

    this.sendIntermediateThrowEventTriggeredNotification(token);

    return [matchingCatchEvent];
  }

  private async getMatchingCatchEvent(
    token: ProcessToken,
    processModelFacade: IProcessModelFacade,
  ): Promise<Model.Events.IntermediateCatchEvent> {

    const matchingCatchEvents = processModelFacade.getLinkCatchEventsByLinkName(this.linkThrowEventModel.linkEventDefinition.name);

    const noMatchingLinkCatchEventExists = !(matchingCatchEvents?.length > 0);
    if (noMatchingLinkCatchEventExists) {
      const errorMessage = `No IntermediateCatchEvent with a link called '${this.linkThrowEventModel.linkEventDefinition.name}' exists!`;
      this.logger.error(errorMessage);

      const notFoundError = new NotFoundError(errorMessage);
      await this.persistOnError(token, notFoundError);

      throw notFoundError;
    }

    // By BPMN Specs, each IntermediateLinkCatchEvent must use a unique link name.
    const tooManyMatchingLinkCatchEvents = matchingCatchEvents.length > 1;
    if (tooManyMatchingLinkCatchEvents) {
      const errorMessage = `Too many CatchEvents for link '${this.linkThrowEventModel.linkEventDefinition.name}' exist!`;
      this.logger.error(errorMessage);

      const notFoundError = new BadRequestError(errorMessage);
      await this.persistOnError(token, notFoundError);

      throw notFoundError;
    }

    return matchingCatchEvents[0];
  }

}
