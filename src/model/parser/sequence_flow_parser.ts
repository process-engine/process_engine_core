import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {createObjectWithCommonProperties, getModelPropertyAsArray} from '../type_factory';

export function parseProcessSequenceFlows(data: any): Array<Model.ProcessElements.SequenceFlow> {

  const sequenceFlowsRaw = getModelPropertyAsArray(data, BpmnTags.OtherElements.SequenceFlow);

  if (!sequenceFlowsRaw) {
    return [];
  }

  const sequenceFlows: Array<Model.ProcessElements.SequenceFlow> = [];

  for (const sequenceFlowRaw of sequenceFlowsRaw) {

    const sequenceFlow = createObjectWithCommonProperties(sequenceFlowRaw, Model.ProcessElements.SequenceFlow);

    sequenceFlow.name = sequenceFlowRaw.name;
    sequenceFlow.sourceRef = sequenceFlowRaw.sourceRef;
    sequenceFlow.targetRef = sequenceFlowRaw.targetRef;

    if (sequenceFlowRaw[BpmnTags.FlowElementProperty.ConditionExpression]) {
      const conditionData = sequenceFlowRaw[BpmnTags.FlowElementProperty.ConditionExpression];

      sequenceFlow.conditionExpression = {
        type: conditionData[BpmnTags.FlowElementProperty.XsiType],
        expression: conditionData._,
      };
    }

    sequenceFlows.push(sequenceFlow);
  }

  return sequenceFlows;
}
