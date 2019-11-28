import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {createObjectWithCommonProperties, getModelPropertyAsArray} from '../type_factory';

export function parseProcessLaneSet(data: any): Model.ProcessElements.LaneSet {

  const laneSetData = data[BpmnTags.Lane.LaneSet] ?? data[BpmnTags.LaneProperty.ChildLaneSet];

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

    const flowNodeReferences = getModelPropertyAsArray(laneRaw, BpmnTags.LaneProperty.FlowNodeRef);

    const laneHasNoFlowNodes = !(flowNodeReferences?.length > 0);
    if (laneHasNoFlowNodes) {
      return laneSet;
    }

    lane.flowNodeReferences = flowNodeReferences.map((reference: string): string => reference.trim());

    if (laneRaw[BpmnTags.LaneProperty.ChildLaneSet]) {
      lane.childLaneSet = parseProcessLaneSet(laneRaw);
    }

    laneSet.lanes.push(lane);
  }

  return laneSet;
}
