import {
  Definitions,
  IExecutionContextFacade,
  IIamFacade,
  IProcessModelPersistenceRepository,
  IProcessModelPersistenceService,
  Model,
} from '@process-engine/process_engine_contracts';

import {IIdentity, IIdentityService} from '@essential-projects/iam_contracts';

import {Identity} from '@process-engine/iam';

import {ForbiddenError, NotFoundError} from '@essential-projects/errors_ts';

export class ProcessModelPersistenceService implements IProcessModelPersistenceService {

  private _processModelPersistenceRepository: IProcessModelPersistenceRepository;
  private _iamFacade: IIamFacade;
  private _identityService: IIdentityService;

  constructor(processModelPersistenceRepository: IProcessModelPersistenceRepository,
              iamFacade: IIamFacade,
              identityService: IIdentityService) {

    this._processModelPersistenceRepository = processModelPersistenceRepository;
    this._iamFacade = iamFacade;
    this._identityService = identityService;
  }

  private get processModelPersistenceRepository(): IProcessModelPersistenceRepository {
    return this._processModelPersistenceRepository;
  }

  private get iamFacade(): IIamFacade {
    return this._iamFacade;
  }

  private get identityService(): IIdentityService {
    return this._identityService;
  }

  public async persistProcessDefinitions(executionContextFacade: IExecutionContextFacade, definitions: Definitions): Promise<void> {
    return this.processModelPersistenceRepository.persistProcessDefinitions(definitions);
  }

  public async getProcessModels(executionContextFacade: IExecutionContextFacade): Promise<Array<Model.Types.Process>> {

    const processModelList: Array<Model.Types.Process> = await this.processModelPersistenceRepository.getProcessModels();

    const filteredList: Array<Model.Types.Process> = [];

    for (const processModel of processModelList) {
      const filteredProcessModel: Model.Types.Process =
        await this._filterInaccessibleProcessModelElements(executionContextFacade, processModel);

      if (filteredProcessModel) {
        filteredList.push(filteredProcessModel);
      }
    }

    return filteredList;
  }

  public async getProcessModelById(executionContextFacade: IExecutionContextFacade, processModelId: string): Promise<Model.Types.Process> {

    const processModel: Model.Types.Process = await this.processModelPersistenceRepository.getProcessModelById(processModelId);

    if (!processModel) {
      throw new NotFoundError(`Process Model with id ${processModelId} not found!`);
    }

    const filteredProcessModel: Model.Types.Process = await this._filterInaccessibleProcessModelElements(executionContextFacade, processModel);

    if (!filteredProcessModel) {
      throw new ForbiddenError('Access denied');
    }

    return filteredProcessModel;
  }

  private async _filterInaccessibleProcessModelElements(executionContextFacade: IExecutionContextFacade,
                                                        processModel: Model.Types.Process,
                                                       ): Promise<Model.Types.Process> {

    const identity: Identity = await this._resolveIdentity(executionContextFacade);

    if (!processModel.laneSet) {
      return processModel;
    }

    processModel.laneSet = await this._filterOutInaccessibleLanes(processModel.laneSet, identity);
    processModel.flowNodes = this._getFlowNodesForLaneSet(processModel.laneSet, processModel.flowNodes);

    const processModelHasAccessibleStartEvent: boolean = this._checkIfProcessModelHasAccessibleStartEvents(processModel);

    if (!processModelHasAccessibleStartEvent) {
      return undefined;
    }

    return processModel;
  }

  private async _filterOutInaccessibleLanes(laneSet: Model.Types.LaneSet, identity: IIdentity): Promise<Model.Types.LaneSet> {

    const filteredLaneSet: Model.Types.LaneSet = Object.assign({}, laneSet);
    filteredLaneSet.lanes = [];

    for (const lane of laneSet.lanes) {

      if (lane.childLaneSet) {
        lane.childLaneSet = await this._filterOutInaccessibleLanes(lane.childLaneSet, identity);
      }

      const userCanAccessLane: boolean = await this.iamFacade.checkIfUserCanAccessLane(identity, lane.name);

      if (userCanAccessLane) {
        filteredLaneSet.lanes.push(lane);
      }
    }

    return filteredLaneSet;
  }

  private _getFlowNodesForLaneSet(laneSet: Model.Types.LaneSet, flowNodes: Array<Model.Base.FlowNode>): Array<Model.Base.FlowNode> {

    const accessibleFlowNodes: Array<Model.Base.FlowNode> = [];

    for (const lane of laneSet.lanes) {

      if (lane.childLaneSet) {
        const accessibleChildLaneFlowNodes: Array<Model.Base.FlowNode> =
          this._getFlowNodesForLaneSet(lane.childLaneSet, flowNodes);

        accessibleFlowNodes.push(...accessibleChildLaneFlowNodes);
      }

      for (const flowNodeId of lane.flowNodeReferences) {
        const matchingFlowNode: Model.Base.FlowNode = flowNodes.find((flowNode: Model.Base.FlowNode): boolean => {
          return flowNode.id === flowNodeId;
        });

        if (matchingFlowNode) {
          accessibleFlowNodes.push(matchingFlowNode);
        }
      }
    }

    return accessibleFlowNodes;
  }

  private _checkIfProcessModelHasAccessibleStartEvents(processModel: Model.Types.Process): boolean {

    // For this check to pass, it is sufficient for the process model to have at least one accessible start event.
    const processModelHasAccessibleStartEvent: boolean = processModel.flowNodes.some((flowNode: Model.Base.FlowNode): boolean => {
      return flowNode instanceof Model.Events.StartEvent;
    });

    return processModelHasAccessibleStartEvent;
  }

  private async _resolveIdentity(executionContextFacade: IExecutionContextFacade): Promise<IIdentity> {

    const userToken: string = executionContextFacade.getIdentityToken();

    const identity: IIdentity = await this.identityService.getIdentity(userToken);

    return identity;
  }
}
