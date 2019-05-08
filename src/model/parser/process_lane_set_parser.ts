import {BpmnTags, Model} from '@process-engine/process_model.contracts';
import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
} from '../type_factory';

export function parseProcessLaneSet(data: any): Model.ProcessElements.LaneSet {

  const laneSetData: any = data[BpmnTags.Lane.LaneSet] || data[BpmnTags.LaneProperty.ChildLaneSet];

  if (!laneSetData) {
    return undefined;
  }

  const lanesRaw: Array<any> = getModelPropertyAsArray(laneSetData, BpmnTags.Lane.Lane);

  const laneSet: Model.ProcessElements.LaneSet = new Model.ProcessElements.LaneSet();
  laneSet.lanes = [];

  if (!lanesRaw) {
    return laneSet;
  }

  for (const laneRaw of lanesRaw) {
    const lane: Model.ProcessElements.Lane = createObjectWithCommonProperties(laneRaw, Model.ProcessElements.Lane);

    lane.name = laneRaw.name;

    const flowNodeReferenceTrimmer: any = (reference: string): string => {
      return reference.trim();
    };

    const flowNodeReferences: Array<string> = getModelPropertyAsArray(laneRaw, BpmnTags.LaneProperty.FlowNodeRef);

    const laneHasNoFlowNodes: boolean = flowNodeReferences === undefined || flowNodeReferences.length === 0;
    if (laneHasNoFlowNodes) {
      return laneSet;
    }

    const trimmedFlowNodeReferences: Array<string> = flowNodeReferences.map(flowNodeReferenceTrimmer);
    lane.flowNodeReferences = trimmedFlowNodeReferences;

    if (laneRaw[BpmnTags.LaneProperty.ChildLaneSet]) {
      lane.childLaneSet = parseProcessLaneSet(laneRaw);
    }

    laneSet.lanes.push(lane);
  }

  return laneSet;
}
