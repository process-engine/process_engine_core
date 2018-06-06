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
      let serviceModule: string;
      let serviceMethod: string;
      let namespace: string;
      let paramString: string;

      props.forEach((prop: any) => {
        if (prop.name === 'module') {
          serviceModule = <string> this.parseExtensionProperty(prop.value, tokenData, context);
        }
        if (prop.name === 'method') {
          serviceMethod = <string> this.parseExtensionProperty(prop.value, tokenData, context);
        }
        if (prop.name === 'params') {
          paramString = <string> this.parseExtensionProperty(prop.value, tokenData, context);
        }
        if (prop.name === 'namespace') {
          namespace = <string> this.parseExtensionProperty(prop.value, tokenData, context);
        }
      });

      if (serviceModule && serviceMethod) {

        const serviceInstance: any = await this.container.resolveAsync(serviceModule);

        let result: any;

        try {

          const dataEventTriggerCallback: Function = (data: any): void => {
            this.triggerEvent(context, 'data', data);
          };

          const serviceTaskFunc: Function = new Function('context', 'token', 'callback', `return ${paramString}`);
          const argumentsToPassThrough: any = serviceTaskFunc.call(tokenData, context, tokenData, dataEventTriggerCallback) || [];

          result = await this.invoker.invoke(serviceInstance, serviceMethod, namespace, context, ...argumentsToPassThrough);

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
