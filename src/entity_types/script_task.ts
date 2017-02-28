import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema} from '@process-engine-js/core_contracts';
import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {IScriptTaskEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';

export class ScriptTaskEntity extends NodeInstanceEntity implements IScriptTaskEntity {

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

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get script(): string {
    return this.getProperty(this, 'script');
  }

  public set script(value: string) {
    this.setProperty(this, 'script', value);
  }

  public async execute(context): Promise<void> {
    const internalContext = await this.iamService.createInternalContext('processengine_system');
    this.state = 'progress';
    await this.save(internalContext);

    const processToken = await this.getProcessToken();
    const tokenData = processToken.data || {};
    let result;

    // call service
    const nodeDef = await this.getNodeDef();
    const script = nodeDef.script;

    if (script) {
      try {
        const scriptFunction = new Function('token', 'context', script);
        result = await scriptFunction.call(this, tokenData, context);
      } catch (err) {
        result = err;
        await this.error(context, err);
      }

      tokenData.current = result;
      processToken.data = tokenData;

      await processToken.save(context);
    }

    await this.changeState(context, 'end', this);
  }
}
