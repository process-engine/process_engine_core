import {
  Definitions,
  IExecutionContextFacade,
  IModelParser,
  IProcessDefinitionRepository,
  IProcessModelService,
  Model,
  ProcessDefinitionRaw,
} from '@process-engine/process_engine_contracts';

import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';

import {ForbiddenError, NotFoundError} from '@essential-projects/errors_ts';

import * as BluebirdPromise from 'bluebird';
import * as clone from 'clone';

export class ProcessModelService implements IProcessModelService {

  private _processDefinitionRepository: IProcessDefinitionRepository;
  private _iamService: IIAMService;
  private _bpmnModelParser: IModelParser = undefined;

  private _canReadProcessModelClaim: string = 'can_read_process_model';
  private _canWriteProcessModelClaim: string = 'can_write_process_model';

  constructor(processDefinitionRepository: IProcessDefinitionRepository,
              iamService: IIAMService,
              bpmnModelParser: IModelParser) {

    this._processDefinitionRepository = processDefinitionRepository;
    this._iamService = iamService;
    this._bpmnModelParser = bpmnModelParser;
  }

  private get processDefinitionRepository(): IProcessDefinitionRepository {
    return this._processDefinitionRepository;
  }

  private get iamService(): IIAMService {
    return this._iamService;
  }

  private get bpmnModelParser(): IModelParser {
    return this._bpmnModelParser;
  }

  public async persistProcessDefinitions(executionContextFacade: IExecutionContextFacade,
                                         name: string,
                                         xml: string,
                                         overwriteExisting: boolean = true,
                                       ): Promise<void> {

    const identity: IIdentity = executionContextFacade.getIdentity();
    await this.iamService.ensureHasClaim(identity, this._canWriteProcessModelClaim);

    return this.processDefinitionRepository.persistProcessDefinitions(name, xml, overwriteExisting);
  }

  public async getProcessModels(executionContextFacade: IExecutionContextFacade): Promise<Array<Model.Types.Process>> {

    const identity: IIdentity = executionContextFacade.getIdentity();
    await this.iamService.ensureHasClaim(identity, this._canReadProcessModelClaim);

    const processModelList: Array<Model.Types.Process> = await this._getProcessModelList();

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

    const processModel: Model.Types.Process = await this._getProcessModelById(executionContextFacade, processModelId);

    const filteredProcessModel: Model.Types.Process = await this._filterInaccessibleProcessModelElements(executionContextFacade, processModel);

    if (!filteredProcessModel) {
      throw new ForbiddenError('Access denied');
    }

    return filteredProcessModel;
  }

  public async getProcessDefinitionAsXmlById(executionContextFacade: IExecutionContextFacade, processModelId: string): Promise<ProcessDefinitionRaw> {

    return Promise.resolve({});
  }

  private async _getProcessModelById(executionContextFacade: IExecutionContextFacade, processModelId: string): Promise<Model.Types.Process> {

    const processModelList: Array<Model.Types.Process> = await this._getProcessModelList();

    for (const process of processModelList) {

      if (process.id === processModelId) {

        return process;
      }
    }

    throw new NotFoundError(`Process Model with id ${processModelId} not found!`);
  }

  private async _getProcessModelList(): Promise<Array<Model.Types.Process>> {

    const definitions: Array<Definitions> = await this._getDefinitionList();

    const allProcessModels: Array<Model.Types.Process> = [];

    for (const definition of definitions) {
      Array.prototype.push.apply(allProcessModels, definition.processes);
    }

    return allProcessModels;
  }

  private async _getDefinitionList(): Promise<Array<Definitions>> {

    const definitionsRaw: Array<ProcessDefinitionRaw> = await this.processDefinitionRepository.getProcessDefinitions();

    const definitionsMapper: any = async(rawProcessModelData: ProcessDefinitionRaw): Promise<Definitions> => {
      return this.bpmnModelParser.parseXmlToObjectModel(rawProcessModelData.xml);
    };

    const definitionsList: Array<Definitions> =
      await BluebirdPromise.map<ProcessDefinitionRaw, Definitions>(definitionsRaw, definitionsMapper);

    return definitionsList;
  }

  private async _filterInaccessibleProcessModelElements(executionContextFacade: IExecutionContextFacade,
                                                        processModel: Model.Types.Process,
                                                       ): Promise<Model.Types.Process> {

    const identity: IIdentity = await executionContextFacade.getIdentity();

    /*
     * Ensure that this method always returns a copy and not a referece
     * to the passed process model.
     */
    const processModelCopy: Model.Types.Process = clone(processModel);

    if (!processModel.laneSet) {
      return processModelCopy;
    }

    processModelCopy.laneSet = await this._filterOutInaccessibleLanes(processModelCopy.laneSet, identity);
    processModelCopy.flowNodes = this._getFlowNodesForLaneSet(processModelCopy.laneSet, processModel.flowNodes);

    const processModelHasAccessibleStartEvent: boolean = this._checkIfProcessModelHasAccessibleStartEvents(processModelCopy);

    if (!processModelHasAccessibleStartEvent) {
      return undefined;
    }

    return processModelCopy;
  }

  private async _filterOutInaccessibleLanes(laneSet: Model.Types.LaneSet, identity: IIdentity): Promise<Model.Types.LaneSet> {

    const filteredLaneSet: Model.Types.LaneSet = clone(laneSet);
    filteredLaneSet.lanes = [];

    for (const lane of laneSet.lanes) {

      const userCanAccessLane: boolean = await this._checkIfUserCanAccesslane(identity, lane.name);

      if (!userCanAccessLane) {
        continue;
      }

      const filteredLane: Model.Types.Lane = clone(lane);

      if (filteredLane.childLaneSet) {
        filteredLane.childLaneSet = await this._filterOutInaccessibleLanes(filteredLane.childLaneSet, identity);
      }

      filteredLaneSet.lanes.push(filteredLane);
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
