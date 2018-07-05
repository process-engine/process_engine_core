import {
  Definitions,
  IExecutionContextFacade,
  IProcessModelPersistenceRepository,
  IProcessModelPersistenceService,
  Model,
} from '@process-engine/process_engine_contracts';

import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';

import {Identity} from '@process-engine/iam';

import {ForbiddenError, NotFoundError} from '@essential-projects/errors_ts';

export class ProcessModelPersistenceService implements IProcessModelPersistenceService {

  private _processModelPersistenceRepository: IProcessModelPersistenceRepository;
  private _iamService: IIAMService;

  private _canReadProcessModelClaim: string = 'can_read_process_model';
  private _canWriteProcessModelClaim: string = 'can_write_process_model';

  constructor(processModelPersistenceRepository: IProcessModelPersistenceRepository,
              iamService: IIAMService) {

    this._processModelPersistenceRepository = processModelPersistenceRepository;
    this._iamService = iamService;
  }

  private get processModelPersistenceRepository(): IProcessModelPersistenceRepository {
    return this._processModelPersistenceRepository;
  }

  private get iamService(): IIAMService {
    return this._iamService;
  }

  public async persistProcessDefinitions(executionContextFacade: IExecutionContextFacade, definitions: Definitions): Promise<void> {

    const identity: IIdentity = executionContextFacade.getIdentity();
    await this.iamService.ensureHasClaim(identity, this._canWriteProcessModelClaim);

    return this.processModelPersistenceRepository.persistProcessDefinitions(definitions);
  }

  public async getProcessModels(executionContextFacade: IExecutionContextFacade): Promise<Array<Model.Types.Process>> {

    const identity: IIdentity = executionContextFacade.getIdentity();
    await this.iamService.ensureHasClaim(identity, this._canReadProcessModelClaim);

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

    const identity: IIdentity = executionContextFacade.getIdentity();
    await this.iamService.ensureHasClaim(identity, this._canReadProcessModelClaim);

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

    const identity: Identity = await executionContextFacade.getIdentity();

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

      const userCanAccessLane: boolean = await this._checkIfUserCanAccesslane(identity, lane.name);

      if (!userCanAccessLane) {
        continue;
      }

      filteredLaneSet.lanes.push(lane);

      if (lane.childLaneSet) {
        lane.childLaneSet = await this._filterOutInaccessibleLanes(lane.childLaneSet, identity);
      }
    }

    return filteredLaneSet;
  }

  private async _checkIfUserCanAccesslane(identity: IIdentity, laneName: string): Promise<boolean> {
    try {
      await this.iamService.ensureHasClaim(identity, laneName);

      return true;
    } catch (error) {
      return false;
    }
  }

  private _getFlowNodesForLaneSet(laneSet: Model.Types.LaneSet, flowNodes: Array<Model.Base.FlowNode>): Array<Model.Base.FlowNode> {

    const accessibleFlowNodes: Array<Model.Base.FlowNode> = [];

    for (const lane of laneSet.lanes) {

      // NOTE: flowNodeReferences are stored in both, the parent lane AND in the child lane!
      // So if we have a lane A with two Sublanes B and C, we must not evaluate the elements from lane A!
      // Consider a user who can only access sublane B.
      // If we were to allow him access to all references stored in lane A, he would also be granted access to the elements
      // from lane C, since they are contained within the reference set of lane A!
      if (lane.childLaneSet) {
        const accessibleChildLaneFlowNodes: Array<Model.Base.FlowNode> =
          this._getFlowNodesForLaneSet(lane.childLaneSet, flowNodes);

        accessibleFlowNodes.push(...accessibleChildLaneFlowNodes);
      } else {
        for (const flowNodeId of lane.flowNodeReferences) {
          const matchingFlowNode: Model.Base.FlowNode = flowNodes.find((flowNode: Model.Base.FlowNode): boolean => {
            return flowNode.id === flowNodeId;
          });

          if (matchingFlowNode) {
            accessibleFlowNodes.push(matchingFlowNode);
          }
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
}
