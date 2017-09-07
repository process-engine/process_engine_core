import {ExecutionContext, IEntity, IInheritedSchema, IToPojoOptions} from '@process-engine-js/core_contracts';
import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {IServiceTaskEntity} from '@process-engine-js/process_engine_contracts';
import { Container, IInstanceWrapper } from 'addict-ioc';

export class ServiceTaskEntity extends NodeInstanceEntity implements IServiceTaskEntity {

  private _container: Container<IInstanceWrapper<any>> = undefined;

  constructor(container: Container<IInstanceWrapper<any>>,
              nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper,
              entityDependencyHelper: EntityDependencyHelper,
              context: ExecutionContext,
              schema: IInheritedSchema) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);

    this._container = container;
  }

  private get container(): Container<IInstanceWrapper<any>> {
    return this._container;
  }

  public async initEntity(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initEntity(actualInstance);
  }

  public async execute(context: ExecutionContext): Promise<void> {
    this.state = 'progress';

    const processToken = this.processToken;
    const tokenData = processToken.data || {};
    let continueEnd = true;

    // call service
    const nodeDef = this.nodeDef;
    const extensions = nodeDef.extensions || null;
    const props = (extensions && extensions.properties) ? extensions.properties : null;
    if (props) {
      let serviceModule;
      let serviceMethod;
      let namespace;
      let paramString;

      props.forEach((prop) => {
        if (prop.name === 'module') {
          serviceModule = <string>this.parseExtensionProperty(prop.value, tokenData, context);
        }
        if (prop.name === 'method') {
          serviceMethod = <string>this.parseExtensionProperty(prop.value, tokenData, context);
        }
        if (prop.name === 'params') {
          paramString = <string>this.parseExtensionProperty(prop.value, tokenData, context);
        }
        if (prop.name === 'namespace') {
          namespace = <string>this.parseExtensionProperty(prop.value, tokenData, context);
        }
      });

      if (serviceModule && serviceMethod) {

        const serviceInstance = await this.container.resolveAsync(serviceModule);

        let result;

        try {

          const self = this;

          const cb = function (data) {
            self.triggerEvent(context, 'data', data);
          };

          const argumentsToPassThrough = (new Function('context', 'token', 'callback', 'return ' + paramString)).call(tokenData, context, tokenData, cb) || [];

          result = await this.invoker.invoke(serviceInstance, serviceMethod, namespace, context, ...argumentsToPassThrough);

        } catch (err) {
          result = err;
          continueEnd = false;
          this.error(context, err);
        }

        let finalResult = result;
        const toPojoOptions: IToPojoOptions = { skipCalculation: true };
        if (result && typeof result.toPojos === 'function') {
          finalResult = await result.toPojos(context, toPojoOptions);
        } else if (result && typeof result.toPojo === 'function') {
          finalResult = await result.toPojo(context, toPojoOptions);
        }

        tokenData.current = finalResult;
        processToken.data = tokenData;
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
