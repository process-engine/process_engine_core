import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema, IEntityReference} from '@process-engine-js/core_contracts';
import {ISubprocessExternalEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';

export class SubprocessExternalEntity extends NodeInstanceEntity implements ISubprocessExternalEntity {

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, 
              entityDependencyHelper: EntityDependencyHelper, 
              context: ExecutionContext,
              schema: IInheritedSchema) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
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

      const source = this.getEntityReference();

      const data = {
        action: 'start',
        data: {
          key: subProcessKey,
          token: tokenData,
          source: source,
          isSubProcess: true
        }
      };

      const msg = this.messageBusService.createEntityMessage(data, this, context);
      await this.messageBusService.publish('/processengine', msg);

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

    await this.changeState(context, 'end', this);
  }
}
