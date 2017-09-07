import {NodeInstanceEntity} from './node_instance';
import {EntityDependencyHelper, IPropertyBag} from '@process-engine-js/data_model_contracts';
import {ExecutionContext, SchemaAttributeType, IEntity, IInheritedSchema} from '@process-engine-js/core_contracts';
import {IExclusiveGatewayEntity, IFlowDefEntity} from '@process-engine-js/process_engine_contracts';
import {schemaAttribute} from '@process-engine-js/metadata';
import {NodeInstanceEntityDependencyHelper} from './node_instance';

export class ExclusiveGatewayEntity extends NodeInstanceEntity implements IExclusiveGatewayEntity {

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper,
              entityDependencyHelper: EntityDependencyHelper,
              context: ExecutionContext,
              schema: IInheritedSchema,
              propertyBag: IPropertyBag) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag);
  }

  public async initialize(): Promise<void> {
    await super.initialize(this);
  }

  @schemaAttribute({ type: SchemaAttributeType.object })
  public get follow(): any {
    return this.getProperty(this, 'follow');
  }

  public set follow(value: any) {
    this.setProperty(this, 'follow', value);
  }

  public async execute(context: ExecutionContext) {

    const nodeDef = this.nodeDef;
    const processDef = this.process.processDef;

    let flowsOut = [];

    for (let i = 0; i < processDef.flowDefCollection.data.length; i++) {
      const flowDef = <IFlowDefEntity>processDef.flowDefCollection.data[i];
      if (flowDef.source.id === nodeDef.id) {
        flowsOut.push(flowDef);
      }
    }

    let flowsIn = [];

    for (let i = 0; i < processDef.flowDefCollection.data.length; i++) {
      const flowDef = <IFlowDefEntity>processDef.flowDefCollection.data[i];
      if (flowDef.target.id === nodeDef.id) {
        flowsIn.push(flowDef);
      }
    }

    if (flowsOut && flowsOut.length > 1 && flowsIn && flowsIn.length === 1) {
      // split
      // evaluate conditions

      const follow: Array<string> = [];

      for (let i = 0; i < flowsOut.length; i++) {
        const flow = <IFlowDefEntity>flowsOut[i];
        if (flow.condition) {

          // const processToken = await this.getProcessToken(internalContext);
          const processToken = this.processToken;

          const tokenData = processToken.data || {};

          let result = false;
          try {
            const functionString = 'return ' + flow.condition;
            const evaluateFunction = new Function('token', functionString);

            result = evaluateFunction.call(tokenData, tokenData);

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

    this.changeState(context, 'end', this);

  }
}
