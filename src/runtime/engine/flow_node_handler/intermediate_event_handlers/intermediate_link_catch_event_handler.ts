import {Logger} from 'loggerhythm';

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

import {FlowNodeHandler} from '../index';

export class IntermediateLinkCatchEventHandler extends FlowNodeHandler<Model.Events.IntermediateCatchEvent> {

  constructor(flowNodeInstanceService: IFlowNodeInstanceService,
              loggingService: ILoggingApi,
              metricsService: IMetricsApi,
              linkCatchEventModel: Model.Events.IntermediateCatchEvent) {
    super(flowNodeInstanceService, loggingService, metricsService, linkCatchEventModel);
    this.logger = Logger.createLogger(`processengine:link_catch_event_handler:${linkCatchEventModel.id}`);
  }

  private get linkCatchEventModel(): Model.Events.IntermediateCatchEvent {
    return super.flowNode;
  }

  protected async executeInternally(token: Runtime.Types.ProcessToken,
                                    processTokenFacade: IProcessTokenFacade,
                                    processModelFacade: IProcessModelFacade,
                                    identity: IIdentity): Promise<NextFlowNodeInfo> {

    this.logger.verbose(`Executing LinkCatchEvent instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return await this._executeHandler(token, processTokenFacade, processModelFacade);
  }

  protected async _executeHandler(token: Runtime.Types.ProcessToken,
                                  processTokenFacade: IProcessTokenFacade,
                                  processModelFacade: IProcessModelFacade): Promise<NextFlowNodeInfo> {

    // This type of FlowNode works pretty much like a regular StartEvent, except that it is called mid-process.
    processTokenFacade.addResultForFlowNode(this.linkCatchEventModel.id, token.payload);
    await this.persistOnExit(token);

    return this.getNextFlowNodeInfo(token, processTokenFacade, processModelFacade);
  }
}
