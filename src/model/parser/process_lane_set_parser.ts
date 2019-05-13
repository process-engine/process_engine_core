import {BpmnTags, Model} from '@process-engine/process_model.contracts';
import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
} from '../type_factory';

export function parseProcessLaneSet(data: any): Model.ProcessElements.LaneSet {

  const laneSetData = data[BpmnTags.Lane.LaneSet] || data[BpmnTags.LaneProperty.ChildLaneSet];

  if (!laneSetData) {
    return undefined;
  }

  const lanesRaw: Array<any> = getModelPropertyAsArray(laneSetData, BpmnTags.Lane.Lane);

  const laneSet = new Model.ProcessElements.LaneSet();
  laneSet.lanes = [];

  if (!lanesRaw) {
    return laneSet;
  }

  for (const laneRaw of lanesRaw) {
    const lane = createObjectWithCommonProperties(laneRaw, Model.ProcessElements.Lane);

    lane.name = laneRaw.name;

    const flowNodeReferenceTrimmer = (reference: string): string => {
      return reference.trim();
    };

    const flowNodeReferences = getModelPropertyAsArray(laneRaw, BpmnTags.LaneProperty.FlowNodeRef);

    const laneHasNoFlowNodes = flowNodeReferences === undefined || flowNodeReferences.length === 0;
    if (laneHasNoFlowNodes) {
      return laneSet;
    }

    const trimmedFlowNodeReferences = flowNodeReferences.map(flowNodeReferenceTrimmer);
    lane.flowNodeReferences = trimmedFlowNodeReferences;

    if (laneRaw[BpmnTags.LaneProperty.ChildLaneSet]) {
      lane.childLaneSet = parseProcessLaneSet(laneRaw);
    }

    laneSet.lanes.push(lane);
  }

  return laneSet;
}
