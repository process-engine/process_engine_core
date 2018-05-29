import {BpmnTags, Model} from '@process-engine/process_engine_contracts';
import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
} from './../type_factory';

export function parseProcessLaneSet(data: any): Model.Types.LaneSet {

    const laneSetData: any = data[BpmnTags.Lane.LaneSet] || data[BpmnTags.LaneProperty.ChildLaneSet];

    if (!laneSetData) {
      return undefined;
    }

    // NOTE: See above, this can be an Object or an Array.
    const lanesRaw: Array<any> = getModelPropertyAsArray(laneSetData, BpmnTags.Lane.Lane);

    const laneSet: Model.Types.LaneSet = new Model.Types.LaneSet();

    if (!lanesRaw) {
      return laneSet;
    }

    for (const laneRaw of lanesRaw) {
      const lane: Model.Types.Lane = createObjectWithCommonProperties(laneRaw, Model.Types.Lane);

      lane.name = laneRaw.name;
      lane.flowNodeReferences = laneRaw[BpmnTags.LaneProperty.FlowNodeRef];

      if (laneRaw[BpmnTags.LaneProperty.ChildLaneSet]) {
        lane.childLaneSet = parseProcessLaneSet(laneRaw);
      }

      laneSet.lanes.push(lane);
    }

    return laneSet;
  }
