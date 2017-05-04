import {ExecutionContext, SchemaAttributeType, IEntity, IEntityReference, IInheritedSchema, ICombinedQueryClause} from '@process-engine-js/core_contracts';
import {EntityDependencyHelper} from '@process-engine-js/data_model_contracts';
import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';
import {schemaAttribute} from '@process-engine-js/metadata';
import {IParallelGatewayEntity, INodeInstanceEntity, IFlowDefEntity, INodeDefEntity} from '@process-engine-js/process_engine_contracts';

export class ParallelGatewayEntity extends NodeInstanceEntity implements IParallelGatewayEntity {

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper, 
              entityDependencyHelper: EntityDependencyHelper, 
              context: ExecutionContext,
              schema: IInheritedSchema) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema);
  }

  public async initialize(derivedClassInstance: IEntity): Promise<void> {
    const actualInstance = derivedClassInstance || this;
    await super.initialize(actualInstance);
  }

  @schemaAttribute({ type: SchemaAttributeType.string })
  public get parallelType(): string {
    return this.getProperty(this, 'parallelType');
  }

  public set parallelType(value: string) {
    this.setProperty(this, 'parallelType', value);
  }


  public async execute(context: ExecutionContext): Promise<void> {

    const nodeDef = await this.nodeDef;
    const processDef = await this.process.processDef;

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
      this.parallelType = 'split';
      // do nothing, just change to end
      this.state = 'progress';

      this.changeState(context, 'end', this);
    }

    if (flowsIn && flowsIn.length > 1 && flowsOut && flowsOut.length === 1) {
      // join
      this.parallelType = 'join';

      // we have to wait for all incoming flows
      this.state = 'wait';

      if (this.process.processDef.persist) {
        const internalContext = await this.iamService.createInternalContext('processengine_system');
        await this.save(internalContext, { reloadAfterSave: false });
      }
    }

  }

  public async proceed(context: ExecutionContext, newData: any, source: IEntity, applicationId: string): Promise<void> {
    // check if all tokens are there
    
    const nodeDef = this.nodeDef;
    const processDef = this.process.processDef;

    const prevDefsKeys: Array<string> = [];

    for (let i = 0; i < processDef.flowDefCollection.data.length; i++) {
      const flowDef = <IFlowDefEntity>processDef.flowDefCollection.data[i];
      if (flowDef.target.id === nodeDef.id) {
        const sourceDefId = flowDef.source.id;

        for (let j = 0; j < processDef.nodeDefCollection.data.length; j++) {
          const sourceDef = <INodeDefEntity>processDef.nodeDefCollection.data[j];
          if (sourceDef.id === sourceDefId) {
            prevDefsKeys.push(sourceDef.key);
          }
        }
      }
    }

    if (prevDefsKeys.length > 0) {
      if (source) {

        const token = await (<INodeInstanceEntity>source).processToken;

        let allthere = true;

        const processToken = this.processToken;
        const tokenData = processToken.data || {};
        tokenData.history = tokenData.history || {};

        // merge tokens
        const merged = { ...tokenData.history, ...token.data.history };
        tokenData.history = merged;

        processToken.data = tokenData;

        prevDefsKeys.forEach((key) => {
          if (!tokenData.history.hasOwnProperty(key)) {
            allthere = false;
          }
        });
        if (allthere) {
          // end
          this.changeState(context, 'end', this);
        } else {
          if (this.process.processDef.persist) {
            const internalContext = await this.iamService.createInternalContext('processengine_system');
            await processToken.save(internalContext, { reloadAfterSave: false });
          }
        }
      }

    }
  }
}
