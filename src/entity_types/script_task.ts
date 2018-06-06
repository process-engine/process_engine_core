import {ExecutionContext, IEntity, IInheritedSchema, IToPojoOptions, SchemaAttributeType} from '@essential-projects/core_contracts';
import {EntityDependencyHelper, IEntityType, IPropertyBag} from '@essential-projects/data_model_contracts';
import {schemaAttribute} from '@essential-projects/metadata';
import {IScriptTaskEntity} from '@process-engine/process_engine_contracts';
import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';

export class ScriptTaskEntity extends NodeInstanceEntity implements IScriptTaskEntity {

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper,
              entityDependencyHelper: EntityDependencyHelper,
              context: ExecutionContext,
              schema: IInheritedSchema,
              propertyBag: IPropertyBag,
              entityType: IEntityType<IEntity>) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType);
  }

  public async initialize(): Promise<void> {
    await super.initialize(this);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get script(): string {
    return this.getProperty(this, 'script');
  }

  public set script(value: string) {
    this.setProperty(this, 'script', value);
  }

  public async execute(context: ExecutionContext): Promise<void> {
    this.state = 'progress';

    let continueToEnd: boolean = true;
    let result: any;

    if (this.nodeDef.script) {
      try {
        result = await this._executeScript(context);
      } catch (err) {
        result = err;
        continueToEnd = false;
        this.error(context, err);
      }

      this.processToken.data.current = await this._transformScriptTaskResultToPojo(context, result);
    }

    if (continueToEnd) {
      this.changeState(context, 'end', this);
    }
  }

  private async _executeScript(context: ExecutionContext): Promise<any> {
    const tokenData: any = this.processToken.data || {};

    const scriptFunction: Function = new Function('token', 'context', this.nodeDef.script);
    const result: any = await scriptFunction.call(this, tokenData, context);

    return result;
  }

  private async _transformScriptTaskResultToPojo(context: ExecutionContext, result: any): Promise<any> {

    let transformedResult: any = result;

    const toPojoOptions: IToPojoOptions = { skipCalculation: true };
    if (result && typeof result.toPojos === 'function') {
      transformedResult = await result.toPojos(context, toPojoOptions);
    } else if (result && typeof result.toPojo === 'function') {
      transformedResult = await result.toPojo(context, toPojoOptions);
    }

    return transformedResult;
  }
}
