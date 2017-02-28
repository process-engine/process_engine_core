import {NodeInstanceEntity} from './node_instance';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, SchemaAttributeType, IEntity} from '@process-engine-js/core_contracts';
import {IExclusiveGatewayEntity, IFlowDefEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

export class ExclusiveGatewayEntity extends NodeInstanceEntity implements IExclusiveGatewayEntity {

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, 
              entityDependencyHelper: EntityDependencyHelper) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper);
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

    const flowDefEntityType = await this.datastoreService.getEntityType('FlowDef');
    const nodeDef = await this.getNodeDef();
    const processDef = await nodeDef.getProcessDef();

    const internalContext = await this.iamService.createInternalContext('processengine_system');

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

      for (let i = 0; i < flowsOut.data.length; i++) {
        const flow = <IFlowDefEntity>flowsOut.data[i];
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
