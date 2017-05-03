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

          const self = this;

          const cb = function (data) {
            const eventData = {
              action: 'event',
              event: 'condition',
              data: data
            };

            const event = self.eventAggregator.createEntityEvent(eventData, self, context);
            self.eventAggregator.publish('/processengine/node/' + self.id, event);
          };

          const argumentsToPassThrough = (new Function('context', 'token', 'callback', 'return ' + paramString)).call(tokenData, context, tokenData, cb) || [];

          

          

          // const orig = process.stdout.write;
          /*process.stdout.write = (function (write) {
            return function (data: string): boolean {
              cb(data);
              write.apply(process.stdout, arguments);
              return true;
            };
          })(process.stdout.write);*/

          result = await this.invoker.invoke(serviceInstance, serviceMethod, namespace, context, ...argumentsToPassThrough);

          // process.stdout.write = orig;

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

        // await processToken.save(internalContext);
      }


    }
    if (continueEnd) {
      this.changeState(context, 'end', this);
    }
  }
}
