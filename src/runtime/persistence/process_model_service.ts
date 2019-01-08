import {
  Definitions,
  IModelParser,
  IProcessDefinitionRepository,
  IProcessModelService,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {IIAMService, IIdentity} from '@essential-projects/iam_contracts';

import {ForbiddenError, NotFoundError, UnprocessableEntityError} from '@essential-projects/errors_ts';

import * as clone from 'clone';
import {Logger} from 'loggerhythm';

const logger: Logger = Logger.createLogger('processengine:persistence:process_model_service');

export class ProcessModelService implements IProcessModelService {

  private readonly _processDefinitionRepository: IProcessDefinitionRepository;
  private readonly _iamService: IIAMService;
  private readonly _bpmnModelParser: IModelParser = undefined;

  private _canReadProcessModelClaim: string = 'can_read_process_model';
  private _canWriteProcessModelClaim: string = 'can_write_process_model';

  constructor(processDefinitionRepository: IProcessDefinitionRepository,
              iamService: IIAMService,
              bpmnModelParser: IModelParser) {

    this._processDefinitionRepository = processDefinitionRepository;
    this._iamService = iamService;
    this._bpmnModelParser = bpmnModelParser;
  }

  public async persistProcessDefinitions(identity: IIdentity,
                                         name: string,
                                         xml: string,
                                         overwriteExisting: boolean = true,
                                       ): Promise<void> {

    await this._iamService.ensureHasClaim(identity, this._canWriteProcessModelClaim);
    await this._validateDefinition(name, xml);

    return this._processDefinitionRepository.persistProcessDefinitions(name, xml, overwriteExisting);
  }

  public async getProcessModels(identity: IIdentity): Promise<Array<Model.Types.Process>> {

    await this._iamService.ensureHasClaim(identity, this._canReadProcessModelClaim);

    const processModelList: Array<Model.Types.Process> = await this._getProcessModelList();

    const filteredList: Array<Model.Types.Process> = [];

    for (const processModel of processModelList) {
      const filteredProcessModel: Model.Types.Process =
        await this._filterInaccessibleProcessModelElements(identity, processModel);

      if (filteredProcessModel) {
        filteredList.push(filteredProcessModel);
      }
    }

    return filteredList;
  }

  public async getProcessModelById(identity: IIdentity, processModelId: string): Promise<Model.Types.Process> {

    await this._iamService.ensureHasClaim(identity, this._canReadProcessModelClaim);

    const processModel: Model.Types.Process = await this._getProcessModelById(processModelId);

    const filteredProcessModel: Model.Types.Process = await this._filterInaccessibleProcessModelElements(identity, processModel);

    if (!filteredProcessModel) {
      throw new ForbiddenError('Access denied.');
    }

    return filteredProcessModel;
  }

  public async getProcessDefinitionAsXmlByName(identity: IIdentity, name: string): Promise<Runtime.Types.ProcessDefinitionFromRepository> {

    await this._iamService.ensureHasClaim(identity, this._canReadProcessModelClaim);

    const definitionRaw: Runtime.Types.ProcessDefinitionFromRepository = await this._processDefinitionRepository.getProcessDefinitionByName(name);

    if (!definitionRaw) {
      throw new NotFoundError(`Process definition with name "${name}" not found!`);
    }

    return definitionRaw;
  }

  public async deleteProcessDefinitionById(processModelId: string): Promise<void> {
    this._processDefinitionRepository.deleteProcessDefinitionById(processModelId);
  }

  /**
   * Takes the xml code of a given ProcessDefinition and tries to parse it.
   * If the parsing is successful, the xml is assumed to be valid.
   * Otherwise an error is thrown.
   *
   * @param name The name of the ProcessDefinition to validate.
   * @param xml  The xml code of the ProcessDefinition to validate.
   */
  private async _validateDefinition(name: string, xml: string): Promise<void> {

    let parsedProcessDefinition: Definitions;

    try {
      parsedProcessDefinition = await this._bpmnModelParser.parseXmlToObjectModel(xml);
    } catch (error) {
      logger.error(`The XML for process "${name}" could not be parsed: ${error.message}`);
      const genericMessage: string = `The XML for process "${name}" could not be parsed.`;
      const cause: string = error.message ? `\nCause: ${error.message}` : '';
      throw new UnprocessableEntityError(`${genericMessage}${cause}`);
    }

    const processDefinitionHasMoreThanOneProcessModel: boolean = parsedProcessDefinition.processes.length > 1;
    if (processDefinitionHasMoreThanOneProcessModel) {
      const tooManyProcessModelsError: string = `The XML for process "${name}" contains more than one ProcessModel. This is currently not supported.`;
      logger.error(tooManyProcessModelsError);

      throw new UnprocessableEntityError(tooManyProcessModelsError);
    }

    const processsModel: Model.Types.Process = parsedProcessDefinition.processes[0];

    const processModelIdIsNotEqualToDefinitionName: boolean = processsModel.id !== name;
    if (processModelIdIsNotEqualToDefinitionName) {
      const namesDoNotMatchError: string = `The ProcessModel contained within the diagram "${name}" must also use the name "${name}"!`;
      logger.error(namesDoNotMatchError);

      throw new UnprocessableEntityError(namesDoNotMatchError);
    }
  }

  /**
   * Retrieves a ProcessModel by its ID.
   * This is achieved by first retrieving a list of ProcessDefinitions and then
   * looking for the process that has the matching ID.
   *
   * @param   processModelId The ID of the ProcessModel to retrieve.
   * @returns                The retrieved ProcessModel.
   */
  private async _getProcessModelById(processModelId: string): Promise<Model.Types.Process> {

    const processModelList: Array<Model.Types.Process> = await this._getProcessModelList();

    const matchingProcessModel: Model.Types.Process = processModelList.find((processModel: Model.Types.Process): boolean => {
      return processModel.id === processModelId;
    });

    if (!matchingProcessModel) {
      throw new NotFoundError(`ProcessModel with id ${processModelId} not found!`);
    }

    return matchingProcessModel;
  }

  /**
   * Retrieves a list of all stored ProcessModels.
   * This is achieved by first retrieving all stored Definitions and then
   * taking all processes belonging to each definition.
   *
   * @returns The retrieved ProcessModels.
   */
  private async _getProcessModelList(): Promise<Array<Model.Types.Process>> {

    const definitions: Array<Definitions> = await this._getDefinitionList();

    const allProcessModels: Array<Model.Types.Process> = [];

    for (const definition of definitions) {
      Array.prototype.push.apply(allProcessModels, definition.processes);
    }

    return allProcessModels;
  }

  /**
   * Retrieves a list of all stored ProcessDefinitions.
   *
   * @returns The retrieved ProcessDefinitions.
   */
  private async _getDefinitionList(): Promise<Array<Definitions>> {

    const definitionsRaw: Array<Runtime.Types.ProcessDefinitionFromRepository> = await this._processDefinitionRepository.getProcessDefinitions();

    const definitionsMapper: any = async(rawProcessModelData: Runtime.Types.ProcessDefinitionFromRepository): Promise<Definitions> => {
      return this._bpmnModelParser.parseXmlToObjectModel(rawProcessModelData.xml);
    };

    const definitionsList: Array<Definitions> =
      await Promise.map<Runtime.Types.ProcessDefinitionFromRepository, Definitions>(definitionsRaw, definitionsMapper);

    return definitionsList;
  }

  /**
   * Performs claim checks for each Element of the given ProcessModel.
   * If the user does not have access to a Element, that Element is filtered out
   * from the ProcessModel.
   *
   * These Elements include both, Lanes and FlowNodes.
   *
   * @param   identity       Contains the Users auth identity.
   * @param   processModelId The ID of the ProcessModel to filter.
   * @returns                The filtered ProcessModel.
   */
  private async _filterInaccessibleProcessModelElements(identity: IIdentity,
                                                        processModel: Model.Types.Process,
                                                       ): Promise<Model.Types.Process> {

    const processModelCopy: Model.Types.Process = clone(processModel);

    const processModelHasNoLanes: boolean = !(processModel.laneSet && processModel.laneSet.lanes && processModel.laneSet.lanes.length > 0);
    if (processModelHasNoLanes) {
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

  /**
   * Performs claim checks for each Lane of the given LaneSet.
   * If the user does not have access to a Lane, that Element is filtered out
   * from the LaneSet.
   *
   * @param   identity       Contains the Users auth identity.
   * @param   processModelId The ID of the ProcessModel to filter.
   * @returns                The filtered ProcessModel.
   */
  private async _filterOutInaccessibleLanes(laneSet: Model.Types.LaneSet, identity: IIdentity): Promise<Model.Types.LaneSet> {

    const filteredLaneSet: Model.Types.LaneSet = clone(laneSet);
    filteredLaneSet.lanes = [];

    for (const lane of laneSet.lanes) {

      const userCanNotAccessLane: boolean = !await this._checkIfUserCanAccesslane(identity, lane.name);
      const filteredLane: Model.Types.Lane = clone(lane);

      if (userCanNotAccessLane) {
        filteredLane.flowNodeReferences = [];
        delete filteredLane.childLaneSet;
      }

      const laneHasChildLanes: boolean = filteredLane.childLaneSet !== undefined &&
                                         filteredLane.childLaneSet !== null;

      if (laneHasChildLanes) {
        filteredLane.childLaneSet = await this._filterOutInaccessibleLanes(filteredLane.childLaneSet, identity);
      }

      filteredLaneSet.lanes.push(filteredLane);
    }

    return filteredLaneSet;
  }

  /**
   * Uses the IAM Service to perform a claim check for the given user and the
   * given Lane.
   *
   * @param   identity Contains the Users identity.
   * @param   laneName The name of the Lane for which to perform claim check.
   * @returns          A Promise, which returns "true", if the user does have
   *                   the claim, or "false", if he does not.
   */
  private async _checkIfUserCanAccesslane(identity: IIdentity, laneName: string): Promise<boolean> {
    try {
      await this._iamService.ensureHasClaim(identity, laneName);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets a list of FlowNodes that belong to the given LaneSet.
   *
   * @param   laneSet   The LaneSet for which to get the FlowNodes.
   * @param   flowNodes A list of FlowNodes from which to look for matches.
   * @returns           A list of FlowNodes, which belong to the given LaneSet.
   */
  private _getFlowNodesForLaneSet(laneSet: Model.Types.LaneSet, flowNodes: Array<Model.Base.FlowNode>): Array<Model.Base.FlowNode> {

    const accessibleFlowNodes: Array<Model.Base.FlowNode> = [];

    for (const lane of laneSet.lanes) {

      // NOTE: flowNodeReferences are stored in both, the parent lane AND in the child lane!
      // So if we have a lane A with two Sublanes B and C, we must not evaluate the elements from lane A!
      // Consider a user who can only access sublane B.
      // If we were to allow him access to all references stored in lane A, he would also be granted access to the elements
      // from lane C, since they are contained within the reference set of lane A!
      const childLaneSetIsNotEmpty: boolean = lane.childLaneSet !== undefined &&
                                              lane.childLaneSet !== null &&
                                              lane.childLaneSet.lanes !== undefined &&
                                              lane.childLaneSet.lanes !== null &&
                                              lane.childLaneSet.lanes.length > 0;

      if (childLaneSetIsNotEmpty) {
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

  /**
   * Checks if the given ProcessModel contains at least one accessible StartEvent.
   *
   * @param   processModel The ProcessModel to check.
   * @returns              True, if at least one acccessible StartEvent exists,
   *                       otherwise false.
   */
  private _checkIfProcessModelHasAccessibleStartEvents(processModel: Model.Types.Process): boolean {

    // For this check to pass, it is sufficient for the ProcessModel to have at least one accessible start event.
    const processModelHasAccessibleStartEvent: boolean = processModel.flowNodes.some((flowNode: Model.Base.FlowNode): boolean => {
      return flowNode instanceof Model.Events.StartEvent;
    });

    return processModelHasAccessibleStartEvent;
  }
}
