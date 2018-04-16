import {ExecutionContext, IEntity, IInheritedSchema, IPrivateSaveOptions, SchemaAttributeType} from '@essential-projects/core_contracts';
import {EntityDependencyHelper, IEntityType, IPropertyBag} from '@essential-projects/data_model_contracts';
import {schemaAttribute} from '@essential-projects/metadata';
import {
  IFlowDefEntity,
  INodeDefEntity,
  INodeInstanceEntity,
  IParallelGatewayEntity,
  IProcessTokenEntity,
} from '@process-engine/process_engine_contracts';
import { sortAndDeduplicateDiagnostics } from 'typescript';
import {NodeInstanceEntity, NodeInstanceEntityDependencyHelper} from './node_instance';

export class ParallelGatewayEntity extends NodeInstanceEntity implements IParallelGatewayEntity {

  constructor(nodeInstanceEntityDependencyHelper: NodeInstanceEntityDependencyHelper,
              entityDependencyHelper: EntityDependencyHelper,
              context: ExecutionContext,
              schema: IInheritedSchema,
              propertyBag: IPropertyBag,
              entityType: IEntityType<IEntity>) {
    super(nodeInstanceEntityDependencyHelper, entityDependencyHelper, context, schema, propertyBag, entityType);
  }

  public async initialize(): Promise<void> {
    await super.initialize(this);
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

    const flowsOut = [];

    for (let i = 0; i < processDef.flowDefCollection.data.length; i++) {
      const flowDef = <IFlowDefEntity> processDef.flowDefCollection.data[i];
      if (flowDef.source.id === nodeDef.id) {
        flowsOut.push(flowDef);
      }
    }

    const flowsIn = [];

    for (let i = 0; i < processDef.flowDefCollection.data.length; i++) {
      const flowDef = <IFlowDefEntity> processDef.flowDefCollection.data[i];
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

  public proceed(context: ExecutionContext, newData: any, source: INodeInstanceEntity, applicationId: string, participant: string): Promise<void> {
    if (source === undefined) {
      return;
    }

    this._mergeTokenHistory(source.processToken);

    const allPathsArrived: boolean = this._checkAllPathsArrived();
    if (!allPathsArrived) {
      return this._persistTokenIfNecessary();
    }

    this.changeState(context, 'end', this);
  }

  private _getKeysOfPreviousNodeDefinitions(): Array<string> {
    const allFlowsOfModel: Array<IFlowDefEntity> = this.process.processDef.flowDefCollection.data;
    const allNodesOfModel: Array<INodeDefEntity> = this.process.processDef.nodeDefCollection.data;

    const prevNodeDefinitionKeys: Array<string> = allNodesOfModel
      .filter((nodeDefinition: INodeDefEntity) => {
        const flowFromNodeToGatewayExists: boolean = allFlowsOfModel.some((flowDefinition: IFlowDefEntity) => {
          return flowDefinition.source.id === nodeDefinition.id && flowDefinition.target.id === this.nodeDef.id;
        });

        return flowFromNodeToGatewayExists;
      })
      .map((nodeDefinition: INodeDefEntity) => {
        return nodeDefinition.key;
      });

    return prevNodeDefinitionKeys;
  }

  private _mergeTokenHistory(tokenWithHistoryToMerge: IProcessTokenEntity): void {
    const gatewayToken: IProcessTokenEntity = this.processToken;
    if (gatewayToken.data === undefined) {
      gatewayToken.data = {};
    }

    if (gatewayToken.data.history === undefined) {
      gatewayToken.data.history = {};
    }

    gatewayToken.data.history = {
      ...gatewayToken.data.history,
      ...tokenWithHistoryToMerge.data.history,
    };
  }

  private _checkAllPathsArrived(): boolean {
    const prevNodeDefinitionKeys: Array<string> = this._getKeysOfPreviousNodeDefinitions();
    const arrivedPaths: Array<string> = Object.keys(this.processToken.data.history);

    const allPathsArrived: boolean = prevNodeDefinitionKeys.every((previousNodeDefinitionKey: string) => {
      return arrivedPaths.includes(previousNodeDefinitionKey);
    });

    return allPathsArrived;
  }

  private async _persistTokenIfNecessary(): Promise<void> {
    if (!this.process.processDef.persist) {
      return;
    }

    const internalContext: ExecutionContext = await this.iamService.createInternalContext('processengine_system');
    const saveOptions: IPrivateSaveOptions = {reloadAfterSave: false};

    return <Promise<any>> this.processToken.save(internalContext, saveOptions);
  }
}
