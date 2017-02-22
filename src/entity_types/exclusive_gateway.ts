import {NodeInstanceEntity} from './node_instance';
import {ExecutionContext, SchemaAttributeType, IFactory, IInheritedSchema, IEntity} from '@process-engine-js/core_contracts';
import {IEntityType, IPropertyBag, IEncryptionService} from '@process-engine-js/data_model_contracts';
import {IInvoker} from '@process-engine-js/invocation_contracts';
import {IExclusiveGatewayEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';

export class ExclusiveGatewayEntity extends NodeInstanceEntity implements IExclusiveGatewayEntity {

  constructor(nodeInstanceHelper: any, propertyBagFactory: IFactory<IPropertyBag>, encryptionService: IEncryptionService, invoker: IInvoker, entityType: IEntityType<IExclusiveGatewayEntity>, context: ExecutionContext, schema: IInheritedSchema) {
    super(nodeInstanceHelper, propertyBagFactory, encryptionService, invoker, entityType, context, schema);
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  @schemaAttribute({ type: SchemaAttributeType.object })
  public get follow(): any {
    return this.getProperty(this, 'follow');
  }

  public set follow(value: any) {
    this.setProperty(this, 'follow', value);
  }

  public async execute(context: ExecutionContext) {

    const flowDefEntityType = await this.helper.datastoreService.getEntityType('FlowDef');
    const nodeDef = await this.getNodeDef();
    const processDef = await nodeDef.getProcessDef();

    const internalContext = await this.helper.iamService.createInternalContext('processengine_system');

    const flowsOut = await flowDefEntityType.query(internalContext, {
      query: [
        { attribute: 'source', operator: '=', value: nodeDef.id },
        { attribute: 'processDef', operator: '=', value: processDef.id }
      ]
    });
    const flowsIn = await flowDefEntityType.query(internalContext, {
      query: [
        { attribute: 'target', operator: '=', value: nodeDef.id },
        { attribute: 'processDef', operator: '=', value: processDef.id }
      ]
    });

    if (flowsOut && flowsOut.length > 1 && flowsIn && flowsIn.length === 1) {
      // split
      // evaluate conditions

      const follow: Array<string> = [];

      for (let i = 0; i < flowsOut._entities.length; i++) {
        const flow = flowsOut.data[i];
        if (flow.condition) {

          const processToken = await this.getProcessToken();
          const tokenData = processToken.data || {};

          let result = false;
          try {
            const functionString = 'return ' + flow.condition;
            const evaluateFunction = new Function(functionString);

            result = evaluateFunction.call(tokenData);
          } catch (err) {
            // do nothing
          }

          if (result) {
            follow.push(flow.id);
          }
        } else {
          follow.push(flow.id);
        }
      }
      this.follow = follow;
    }

    if (flowsIn && flowsIn.length > 1 && flowsOut && flowsOut.length === 1) {
      // join

    }

    this.state = 'progress';
    await this.save(internalContext);

    await this.changeState(context, 'end', this);

  }
}
