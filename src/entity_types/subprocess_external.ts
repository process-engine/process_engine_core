import {ExecutionContext, IEntity, IInheritedSchema} from '@essential-projects/core_contracts';
import {EntityDependencyHelper, IEntityType, IPropertyBag} from '@essential-projects/data_model_contracts';
import {IParamStart, IProcessDefEntityTypeService, ISubprocessExternalEntity} from '@process-engine/process_engine_contracts';
import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';

import {Logger} from 'loggerhythm';
const logger: Logger = Logger.createLogger('processengine').createChildLogger('subprocess_external');

export class SubprocessExternalEntity extends NodeInstanceEntity implements ISubprocessExternalEntity {

  private _processDefEntityTypeService: IProcessDefEntityTypeService = undefined;

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper,
              processDefEntityTypeService: IProcessDefEntityTypeService,
              entityDependencyHelper: EntityDependencyHelper,
              context: ExecutionContext,
              schema: IInheritedSchema,
              propertyBag: IPropertyBag,
              entityType: IEntityType<IEntity>) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType);

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
    const tokenData: any = processToken.data || {};
    const currentToken: any = tokenData.current;

    // call sub process
    const nodeDef = this.nodeDef;
    const subProcessKey = nodeDef.subProcessKey || null;
    if (!subProcessKey) {
      return logger.warn(`No key provided for '${this.key}'`);
    }

    const params: IParamStart = {
      key: subProcessKey,
      source: this,
      isSubProcess: true,
      initialToken: currentToken,
    };
    const subProcessRef = await this.processDefEntityTypeService.start(internalContext, params);
    this.process.boundProcesses[subProcessRef.id] = subProcessRef;
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
