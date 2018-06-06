import {ExecutionContext, IEntity, IInheritedSchema, IToPojoOptions} from '@essential-projects/core_contracts';
import {EntityDependencyHelper, IEntityType, IPropertyBag} from '@essential-projects/data_model_contracts';
import {IServiceTaskEntity} from '@process-engine/process_engine_contracts';
import { Container, IInstanceWrapper } from 'addict-ioc';
import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';

export class ServiceTaskEntity extends NodeInstanceEntity implements IServiceTaskEntity {

  private _container: Container<IInstanceWrapper<any>> = undefined;

  constructor(container: Container<IInstanceWrapper<any>>,
              nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper,
              entityDependencyHelper: EntityDependencyHelper,
              context: ExecutionContext,
              schema: IInheritedSchema,
              propertyBag: IPropertyBag,
              entityType: IEntityType<IEntity>) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType);

    this._container = container;
  }

  private get container(): Container<IInstanceWrapper<any>> {
    return this._container;
  }

  public async initialize(): Promise<void> {
    await super.initialize(this);
  }

  // tslint:disable-next-line:cyclomatic-complexity
  public async execute(context: ExecutionContext): Promise<void> {
    this.state = 'progress';

    const tokenData: any = this.processToken.data || {};
    let continueEnd: boolean = true;

    // call service
    const extensions: any = this.nodeDef.extensions || null;
    const props: any = (extensions && extensions.properties) ? extensions.properties : null;
    if (props) {
      let namespace: string;
      let moduleName: string;
      let methodName: string;
      let parametersAsString: string;

      props.forEach((prop: any) => {
        if (prop.name === 'namespace') {
          namespace = <string> this.parseExtensionProperty(prop.value, tokenData, context);
        }
        if (prop.name === 'module') {
          moduleName = <string> this.parseExtensionProperty(prop.value, tokenData, context);
        }
        if (prop.name === 'method') {
          methodName = <string> this.parseExtensionProperty(prop.value, tokenData, context);
        }
        if (prop.name === 'params') {
          parametersAsString = <string> this.parseExtensionProperty(prop.value, tokenData, context);
        }
      });

      if (moduleName && methodName) {

        const serviceInstance: any = await this.container.resolveAsync(moduleName);

        let result: any;

        try {

          const dataEventTriggerCallback: Function = (data: any): void => {
            this.triggerEvent(context, 'data', data);
          };

          const getArgsFunction: Function = new Function('context', 'token', 'callback', `return ${parametersAsString}`);
          const argumentsToPassThrough: any = getArgsFunction.call(tokenData, context, tokenData, dataEventTriggerCallback) || [];

          result = await this.invoker.invoke(serviceInstance, methodName, namespace, context, ...argumentsToPassThrough);

        } catch (err) {
          result = err;
          continueEnd = false;
          this.error(context, err);
        }

        let finalResult: any = result;
        const toPojoOptions: IToPojoOptions = { skipCalculation: true };
        if (result && typeof result.toPojos === 'function') {
          finalResult = await result.toPojos(context, toPojoOptions);
        } else if (result && typeof result.toPojo === 'function') {
          finalResult = await result.toPojo(context, toPojoOptions);
        }

        tokenData.current = finalResult;
        this.processToken.data = tokenData;
      } else {
        continueEnd = false;
        this.error(context, new Error('missing extensions properties'));
      }

    }
    if (continueEnd) {
      this.changeState(context, 'end', this);
    }
  }
}
