import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {createObjectWithCommonProperties, getModelPropertyAsArray} from '../type_factory';

export function parseProcessSequenceFlows(data: any): Array<Model.ProcessElements.SequenceFlow> {

  // NOTE: See above, this can be an Object or an Array (Admittedly, the first is somewhat unlikely here, but not impossible).
  const sequenceFlowsRaw = getModelPropertyAsArray(data, BpmnTags.OtherElements.SequenceFlow);

  if (!sequenceFlowsRaw) {
    return [];
  }

  const sequences: Array<Model.ProcessElements.SequenceFlow> = [];

  for (const sequenceRaw of sequenceFlowsRaw) {

    const sequenceFlow = createObjectWithCommonProperties(sequenceRaw, Model.ProcessElements.SequenceFlow);

    sequenceFlow.name = sequenceRaw.name;
    sequenceFlow.sourceRef = sequenceRaw.sourceRef;
    sequenceFlow.targetRef = sequenceRaw.targetRef;

    if (sequenceRaw[BpmnTags.FlowElementProperty.ConditionExpression]) {
      const conditionData = sequenceRaw[BpmnTags.FlowElementProperty.ConditionExpression];

      sequenceFlow.conditionExpression = {
        type: conditionData[BpmnTags.FlowElementProperty.XsiType],
        expression: conditionData._,
      };
    }

    sequences.push(sequenceFlow);
  }

  return sequences;
}
