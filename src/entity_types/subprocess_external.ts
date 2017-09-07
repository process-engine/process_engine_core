import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';
import {EntityDependencyHelper, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, IEntity, IInheritedSchema} from '@process-engine-js/core_contracts';
import {ISubprocessExternalEntity, IProcessDefEntityTypeService, IParamStart} from '@process-engine-js/process_engine_contracts';

import * as debug from 'debug';

const debugInfo = debug('processengine:info');
// const debugErr = debug('processengine:error');

export class SubprocessExternalEntity extends NodeInstanceEntity implements ISubprocessExternalEntity {

  private _processDefEntityTypeService: IProcessDefEntityTypeService = undefined;

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper,
              processDefEntityTypeService: IProcessDefEntityTypeService,
              entityDependencyHelper: EntityDependencyHelper,
              context: ExecutionContext,
              schema: IInheritedSchema,
              propertyBag: IPropertyBag) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag);

    this._processDefEntityTypeService = processDefEntityTypeService;
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

    const processToken = this.processToken;
    const tokenData = processToken.data || {};

    // call sub process
    const nodeDef = this.nodeDef;
    const subProcessKey = nodeDef.subProcessKey || null;
    if (subProcessKey) {

      const params: IParamStart = {
        key: subProcessKey,
        source: this,
        isSubProcess: true,
        initialToken: tokenData
      };
      const subProcessRef = await this.processDefEntityTypeService.start(internalContext, params);
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
