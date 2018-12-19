import {Logger} from 'loggerhythm';

import {NotFoundError} from '@essential-projects/errors_ts';
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

import {FlowNodeHandlerInterruptible} from '../index';

export class IntermediateLinkThrowEventHandler extends FlowNodeHandlerInterruptible<Model.Events.IntermediateCatchEvent> {

  constructor(flowNodeInstanceService: IFlowNodeInstanceService,
              loggingService: ILoggingApi,
              metricsService: IMetricsApi,
              linkThrowEventModel: Model.Events.IntermediateCatchEvent) {
    super(flowNodeInstanceService, loggingService, metricsService, linkThrowEventModel);
    this.logger = Logger.createLogger(`processengine:link_throw_event_handler:${linkThrowEventModel.id}`);
  }

  private get linkThrowEventModel(): Model.Events.IntermediateCatchEvent {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Executing LinkThrowEvent instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return await this._executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade): Promise<NextFlowNodeInfo> {

    // LinkEvents basically work like SequenceFlows, in that they do nothing but direct
    // the ProcessInstance to another FlowNode.
    const matchingCatchEvent: Model.Events.IntermediateCatchEvent =
      processModelFacade.getLinkCatchEventByLinkName(this.linkThrowEventModel.linkEventDefinition.name);

    const noMatchingLinkCatchEventExists: boolean = !matchingCatchEvent;
    if (noMatchingLinkCatchEventExists) {
      const errorMessage: string = `No IntermediateCatchEvent with a link called '${this.linkThrowEventModel.linkEventDefinition.name}' exists!`;
      this.logger.error(errorMessage);

      const notFoundError: NotFoundError = new NotFoundError(errorMessage);
      await this.persistOnError(token, notFoundError);

      throw notFoundError;
    }

    processTokenFacade.addResultForFlowNode(this.linkThrowEventModel.id, token.payload);
    await this.persistOnExit(token);

    return new NextFlowNodeInfo(matchingCatchEvent, token, processTokenFacade);
  }
}
