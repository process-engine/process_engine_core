import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema, IEntityReference} from '@process-engine-js/core_contracts';
import {ISubprocessExternalEntity, IProcessDefEntityTypeService, IParamStart} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';

import * as debug from 'debug';

const debugInfo = debug('processengine:info');
const debugErr = debug('processengine:error');

export class SubprocessExternalEntity extends NodeInstanceEntity implements ISubprocessExternalEntity {

  private _processDefEntityTypeService: IProcessDefEntityTypeService = undefined;

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper,
              processDefEntityTypeService: IProcessDefEntityTypeService,
              entityDependencyHelper: EntityDependencyHelper, 
              context: ExecutionContext,
              schema: IInheritedSchema) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);

    this._processDefEntityTypeService = processDefEntityTypeService;
  }

  private get processDefEntityTypeService(): IProcessDefEntityTypeService {
    return this._processDefEntityTypeService;
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  public async execute(context: ExecutionContext): Promise<void> {
    const internalContext = await this.iamService.createInternalContext('processengine_system');
    this.state = 'wait';
    await this.save(internalContext);

    const processToken = await this.getProcessToken(internalContext);
    const tokenData = processToken.data || {};

    // call sub process
    const nodeDef = await this.getNodeDef(internalContext);
    const subProcessKey = nodeDef.subProcessKey || null;
    if (subProcessKey) {

      const params: IParamStart = {
        key: subProcessKey,
        source: this,
        isSubProcess: true,
        initialToken: tokenData
      };
      await this.processDefEntityTypeService.start(internalContext, params);
    } else {
      debugInfo(`No key is provided for call activity key '${this.key}'`);
    }
    
  }

  public async proceed(context: ExecutionContext, newData: any, source: IEntityReference, applicationId: string): Promise<void> {

    const internalContext = await this.iamService.createInternalContext('processengine_system');

    // save new data in token
    const processToken = await this.getProcessToken(internalContext);
    const tokenData = processToken.data || {};
    tokenData.current = newData;
    processToken.data = tokenData;

    await processToken.save(internalContext);

    this.changeState(context, 'end', this);
  }
}
