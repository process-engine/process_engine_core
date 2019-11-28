import * as moment from 'moment';

import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';
import {getValueFromExtensionProperty} from './extension_property_parser';

export function parseUserTasks(processData: any): Array<Model.Activities.UserTask> {

  const userTasks: Array<Model.Activities.UserTask> = [];

  const userTasksRaw = getModelPropertyAsArray(processData, BpmnTags.TaskElement.UserTask);

  const noUserTasksFound = !(userTasksRaw?.length > 0);
  if (noUserTasksFound) {
    return [];
  }

  for (const userTaskRaw of userTasksRaw) {
    const userTask = createActivityInstance(userTaskRaw, Model.Activities.UserTask);

    userTask.assignee = userTaskRaw[BpmnTags.CamundaProperty.Assignee];
    userTask.candidateUsers = userTaskRaw[BpmnTags.CamundaProperty.CandidateUsers];
    userTask.candidateGroups = userTaskRaw[BpmnTags.CamundaProperty.CandidateGroups];
    userTask.dueDate = parseDate(userTaskRaw[BpmnTags.CamundaProperty.DueDate]);
    userTask.followUpDate = parseDate(userTaskRaw[BpmnTags.CamundaProperty.FollowupDate]);
    userTask.formFields = parseFormFields(userTaskRaw);
    userTask.preferredControl = getPreferredControlForUserTask(userTaskRaw);
    userTask.description = getDescriptionForUserTask(userTaskRaw);
    userTask.finishedMessage = getFinishedMessageForUserTask(userTaskRaw);

    userTasks.push(userTask);
  }

  function parseFormFields(userTaskRaw: any): Array<Model.Activities.Types.UserTaskFormField> {

    const extensionElements = userTaskRaw[BpmnTags.FlowElementProperty.ExtensionElements];
    if (!extensionElements) {
      return [];
    }

    const formDataRaw = extensionElements[BpmnTags.CamundaProperty.FormData];
    if (!formDataRaw) {
      return [];
    }

    const formFieldsRaw = getModelPropertyAsArray(formDataRaw, BpmnTags.CamundaProperty.FormField);
    if (!formFieldsRaw) {
      return [];
    }

    const formFields: Array<Model.Activities.Types.UserTaskFormField> = [];

    for (const formFieldRaw of formFieldsRaw) {
      const formField = parseFormField(formFieldRaw);
      formFields.push(formField);
    }

    return formFields;
  }

  function parseFormField(formFieldRaw: any): Model.Activities.Types.UserTaskFormField {

    const formField = new Model.Activities.Types.UserTaskFormField();

    formField.id = formFieldRaw.id;
    formField.label = formFieldRaw.label;
    formField.type = formFieldRaw.type;
    formField.defaultValue = formFieldRaw.defaultValue;
    formField.preferredControl = formFieldRaw.preferredControl;

    if (formField.type === 'enum') {
      const rawValues = getModelPropertyAsArray(formFieldRaw, BpmnTags.CamundaProperty.Value);

      const valueMapper: any = (enumValueRaw: any): Model.Activities.Types.FormFieldEnumValue => {
        const enumValue = new Model.Activities.Types.FormFieldEnumValue();
        enumValue.id = enumValueRaw.id;
        enumValue.name = enumValueRaw.name;

        return enumValue;
      };
      formField.enumValues = rawValues ? rawValues.map(valueMapper) : [];
    }

    return formField;
  }

  function parseDate(value: string): Date {

    const isNoValidDate = !(value?.length > 0) || !moment(value, 'YYYY-MM-DDTHH:mm:ss', true).isValid();
    if (isNoValidDate) {
      return undefined;
    }

    const dateObj = moment(value);

    return dateObj.toDate();
  }

  return userTasks;
}

function getPreferredControlForUserTask(userTaskRaw: Model.Activities.UserTask): string {
  return getValueFromExtensionProperty('preferredControl', userTaskRaw);
}

function getDescriptionForUserTask(userTaskRaw: Model.Activities.UserTask): string {
  return getValueFromExtensionProperty('description', userTaskRaw);
}

function getFinishedMessageForUserTask(userTaskRaw: Model.Activities.UserTask): string {
  return getValueFromExtensionProperty('finishedMessage', userTaskRaw);
}
