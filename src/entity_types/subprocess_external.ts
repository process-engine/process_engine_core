import {IConsumerApiService} from '@process-engine/consumer_api_contracts';
import {ExecutionContext, IEntity, IInheritedSchema} from '@essential-projects/core_contracts';
import {EntityDependencyHelper, IEntityType, IPropertyBag} from '@essential-projects/data_model_contracts';
import {IParamStart, IProcessDefEntityTypeService, ISubprocessExternalEntity} from '@process-engine/process_engine_contracts';
import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';

import * as debug from 'debug';

const debugInfo = debug('processengine:info');

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
    const internalContext = await this.iamService.createInternalContext('processengine_system');
    this.state = 'wait';

    if (this.process.processDef.persist) {
      await this.save(internalContext, { reloadAfterSave: false });
    }

    // call sub process
    const subProcessKey = this.nodeDef.subProcessKey || null;
    if (subProcessKey) {
      debugInfo(`Executing Call activity with process model key '${this.key}'`);

      let initialToken: any;
  
      if (this.processToken && this.processToken.data) {
        initialToken = this.processToken.data.current || {};
      }

      const params: IParamStart = {
        key: subProcessKey,
        source: this,
        isSubProcess: true,
        initialToken: initialToken,
        participant: this.participant,
      };

      const subProcessRef = await this.processDefEntityTypeService.start(context, params);
      this.process.boundProcesses[subProcessRef.id] = subProcessRef;

    } else {
      debugInfo(`No key is provided for call activity key '${this.key}'`);
    }

  }

  public async proceed(context: ExecutionContext, newData: any, source: IEntity, applicationId: string, participant: string): Promise<void> {

    // save new data in token
    const processToken = this.processToken;
    const tokenData = processToken.data || {};
    tokenData.current = newData;
    processToken.data = tokenData;

    this.changeState(context, 'end', this);
  }
}
