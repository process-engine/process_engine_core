import {ExecutionContext, SchemaAttributeType, IEntity} from '@process-engine-js/core_contracts';
import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {IServiceTaskEntity} from '@process-engine-js/process_engine_contracts';
import { DependencyInjectionContainer } from 'addict-ioc';

export class ServiceTaskEntity extends NodeInstanceEntity implements IServiceTaskEntity {

  private _container: DependencyInjectionContainer = undefined;

  constructor(container: DependencyInjectionContainer, 
              nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, 
              entityDependencyHelper: EntityDependencyHelper) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper);
    
    this._container = container;
  }

  private get container(): DependencyInjectionContainer {
    return this._container;
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  public async execute(context: ExecutionContext) {
    const internalContext = await this.iamService.createInternalContext('processengine_system');
    this.state = 'progress';
    await this.save(internalContext);

    const processToken = await this.getProcessToken();
    const tokenData = processToken.data || {};
    let continueEnd = true;

    // call service
    const nodeDef = await this.getNodeDef();
    const extensions = nodeDef.extensions || null;
    const props = (extensions && extensions.properties) ? extensions.properties : null;
    if (props) {
      let serviceModule;
      let serviceMethod;
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
      });

      if (serviceModule && serviceMethod) {

        const service = this.container.resolve(serviceModule);

        let params = [];
        let result;
        try {
          const functionString = 'return ' + paramString;
          const evaluateFunction = new Function(functionString);

          params = evaluateFunction.call(tokenData);

          result = await service[serviceMethod].apply(this, [context].concat(params));

        } catch (err) {
          result = err;
          continueEnd = false;
          await this.error(context, err);
        }

        tokenData.current = result;
        processToken.data = tokenData;

        await processToken.save(null, internalContext);
      }


    }
    if (continueEnd) {
      await this.changeState(context, 'end', this);
    }
  }
}
