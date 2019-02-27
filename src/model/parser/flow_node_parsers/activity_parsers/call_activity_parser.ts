import {BpmnTags, Model} from '@process-engine/process_model.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';

export function parseCallActivities(processData: any): Array<Model.Activities.CallActivity> {

  const callActivities: Array<Model.Activities.CallActivity> = [];

  const callActivitiesRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.CallActivity);

  if (!callActivitiesRaw || callActivitiesRaw.length === 0) {
    return [];
  }

  for (const callActivityRaw of callActivitiesRaw) {
    let callActivity: Model.Activities.CallActivity = createActivityInstance(callActivityRaw, Model.Activities.CallActivity);

    if (callActivityRaw.calledElement) {
      // NOTE: There is also a CMMN type, which is not supported yet.
      callActivity.type = Model.Activities.CallActivityType.BPMN;
      callActivity.calledReference = callActivityRaw.calledElement;
      callActivity.bindingType = <Model.Activities.CallActivityBindingType> callActivityRaw[BpmnTags.CamundaProperty.CalledElementBinding];

      if (callActivity.bindingType === Model.Activities.CallActivityBindingType.version) {
        callActivity.calledElementVersion = callActivityRaw[BpmnTags.CamundaProperty.CalledElementVersion];
      }
      callActivity.calledElementTenantId = callActivityRaw[BpmnTags.CamundaProperty.CalledElementTenantId];

      callActivity = determineCallActivityMappingType(callActivity, callActivityRaw);
    }

    callActivities.push(callActivity);
  }

  return callActivities;
}

function determineCallActivityMappingType(callActivity: Model.Activities.CallActivity, data: any): Model.Activities.CallActivity {

  if (data[BpmnTags.CamundaProperty.VariableMappingClass]) {

    callActivity.delegateVariableMapping = Model.Activities.CallActivityDelegateVariableMapping.variableMappingClass;
    callActivity.variableMappingValue = data[BpmnTags.CamundaProperty.VariableMappingClass];

  } else if (data[BpmnTags.CamundaProperty.VariableMappingDelegateExpression]) {

    callActivity.delegateVariableMapping = Model.Activities.CallActivityDelegateVariableMapping.variableMappingDelegateExpression;
    callActivity.variableMappingValue = data[BpmnTags.CamundaProperty.VariableMappingDelegateExpression];

  } else {
    callActivity.delegateVariableMapping = Model.Activities.CallActivityDelegateVariableMapping.Unspecified;
  }

  return callActivity;
}
