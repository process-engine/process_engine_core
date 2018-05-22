import {ConsumerContext,
        IConsumerApiService,
        ICorrelationResult,
        ProcessModel,
        ProcessStartRequestPayload,
        ProcessStartResponsePayload,
        StartCallbackType,
} from '@process-engine/consumer_api_contracts';

import {ExecutionContext, IEntity, IInheritedSchema} from '@essential-projects/core_contracts';
import {EntityDependencyHelper, IEntityType, IPropertyBag} from '@essential-projects/data_model_contracts';
import {IParamStart, IProcessDefEntityTypeService, ISubprocessExternalEntity} from '@process-engine/process_engine_contracts';

import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';

import * as debug from 'debug';

const debugInfo: debug.IDebugger = debug('processengine:info');

export class SubprocessExternalEntity extends NodeInstanceEntity implements ISubprocessExternalEntity {

  private _processDefEntityTypeService: IProcessDefEntityTypeService = undefined;
  private _consumerApiService: IConsumerApiService = undefined;

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper,
              processDefEntityTypeService: IProcessDefEntityTypeService,
              consumerApiService: IConsumerApiService,
              entityDependencyHelper: EntityDependencyHelper,
              context: ExecutionContext,
              schema: IInheritedSchema,
              propertyBag: IPropertyBag,
              entityType: IEntityType<IEntity>) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType);

    this._processDefEntityTypeService = processDefEntityTypeService;
    this._consumerApiService = consumerApiService;
  }

  private get consumerApiService(): IConsumerApiService {
    return this._consumerApiService;
  }

  private get processDefEntityTypeService(): IProcessDefEntityTypeService {
    return this._processDefEntityTypeService;
  }

  public async initialize(): Promise<void> {
    await super.initialize(this);
  }

  public async execute(context: ExecutionContext): Promise<void> {
    const internalContext: ExecutionContext = await this.iamService.createInternalContext('processengine_system');
    this.state = 'progress';

    if (this.process.processDef.persist) {
      await this.save(internalContext, { reloadAfterSave: false });
    }

    const subProcessKey: string = this.nodeDef.subProcessKey || null;
    if (!subProcessKey) {
      debugInfo(`No key is provided for call activity key '${this.key}'`);
      this.changeState(context, 'end', this);

      return;
    }

    debugInfo(`Executing Call activity '${this.key}', using subprocess key '${subProcessKey}'`);

    const result: ICorrelationResult = await this._executeSubProcess(context);

    // save new data in token
    const tokenData: any = this.processToken.data || {};
    tokenData.current = result;
    this.processToken.data = tokenData;

    this.changeState(context, 'end', this);
  }

  private async _executeSubProcess(context: ExecutionContext): Promise<ICorrelationResult> {

    const consumerContext: ConsumerContext = {
      identity: context.encryptedToken,
    };

    const startEventKey: string = await this._getAccessibleSubProcessStartEvent(consumerContext, this.nodeDef.subProcessKey);
    const correlationId: string = await this._waitForSubProcessToFinishAndReturnCorrelationId(consumerContext, startEventKey);
    const correlationResult: ICorrelationResult = await this._retrieveSubProcessResult(consumerContext, correlationId);

    return correlationResult;
  }

  private async _getAccessibleSubProcessStartEvent(consumerContext: ConsumerContext, subProcessKey: string): Promise<string> {

    const processModel: ProcessModel = await this.consumerApiService.getProcessModelByKey(consumerContext, subProcessKey);

    // Pick the first accessible start event
    // Note: If the user cannot access the process model and/or its start events, the consumer api will already have thrown an error.
    const startEventKey: string = processModel.startEvents[0].key;

    return startEventKey;
  }

  private async _waitForSubProcessToFinishAndReturnCorrelationId(consumerContext: ConsumerContext, startEventKey: string): Promise<string> {

    const startCallbackType: StartCallbackType = StartCallbackType.CallbackOnEndEventReached;

    const payload: ProcessStartRequestPayload = {
      correlation_id: undefined, // Let the consumer API generate a correlation id.
      callerId: this.id,
      input_values: {},
    };

    const result: ProcessStartResponsePayload =
      await this.consumerApiService.startProcessInstance(consumerContext, this.nodeDef.subProcessKey, startEventKey, payload, startCallbackType);

    const correlationId: string = result.correlation_id;

    return correlationId;
  }

  private async _retrieveSubProcessResult(context: ConsumerContext, correlationId: string): Promise<ICorrelationResult> {

    const correlationResult: ICorrelationResult =
      await this.consumerApiService.getProcessResultForCorrelation(context, correlationId, this.nodeDef.subProcessKey);

    return correlationResult;
  }
}
