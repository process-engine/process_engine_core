import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema, IToPojoOptions} from '@process-engine-js/core_contracts';
import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {IServiceTaskEntity} from '@process-engine-js/process_engine_contracts';
import { DependencyInjectionContainer } from 'addict-ioc';

export class ServiceTaskEntity extends NodeInstanceEntity implements IServiceTaskEntity {

  private _container: DependencyInjectionContainer = undefined;

  constructor(container: DependencyInjectionContainer,
              nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, 
              entityDependencyHelper: EntityDependencyHelper, 
              context: ExecutionContext,
              schema: IInheritedSchema) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
    
    this._container = container;
  }

  private get container(): DependencyInjectionContainer {
    return this._container;
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  public async execute(context: ExecutionContext): Promise<void> {
    const internalContext = await this.iamService.createInternalContext('processengine_system');
    this.state = 'progress';
    await this.save(internalContext);

    const processToken = await this.getProcessToken(internalContext);
    const tokenData = processToken.data || {};
    let continueEnd = true;

    // call service
    const nodeDef = await this.getNodeDef(internalContext);
    const extensions = nodeDef.extensions || null;
    const props = (extensions && extensions.properties) ? extensions.properties : null;
    if (props) {
      let serviceModule;
      let serviceMethod;
      let namespace;
      let paramString;

      props.forEach((prop) => {
        if (prop.name === 'module') {
          serviceModule = prop.value;
        }
        if (prop.name === 'method') {
          serviceMethod = prop.value;
        }
        if (prop.name === 'params') {
          paramString = prop.value;
        }
        if (prop.name === 'namespace') {
          namespace = prop.value;
        }
      });

      if (serviceModule && serviceMethod) {

        const serviceInstance = this.container.resolve(serviceModule);

        let result;
        
        try {

          const argumentsToPassThrough = (new Function('context', 'token', 'return ' + paramString)).call(tokenData, context, tokenData) || [];

          result = await this.invoker.invoke(serviceInstance, serviceMethod, namespace, context, ...argumentsToPassThrough);

        } catch (err) {
          result = err;
          continueEnd = false;
          await this.error(context, err);
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

        await processToken.save(internalContext);
      }


    }
    if (continueEnd) {
      this.changeState(context, 'end', this);
    }
  }
}
