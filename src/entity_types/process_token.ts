import {ExecutionContext, SchemaAttributeType, IEntity} from '@process-engine-js/core_contracts';
import {Entity, EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {IProcessTokenEntity, IProcessEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';

export class ProcessTokenEntity extends Entity implements IProcessTokenEntity {

  constructor(entityDependencyHelper: EntityDependencyHelper) {
    super(entityDependencyHelper);
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  @schemaAttribute({ type: SchemaAttributeType.object })
  public get data(): any {
    return this.getProperty(this, 'data');
  }

  public set data(value: any) {
    this.setProperty(this, 'data', value);
  }


  @schemaAttribute({ type: 'Process' })
  public get process(): IProcessEntity {
    return this.getProperty(this, 'process');
  }

  public set process(value: IProcessEntity) {
    this.setProperty(this, 'process', value);
  }

  public getProcess(): Promise<IProcessEntity> {
    return this.getPropertyLazy(this, 'process');
  }

}
