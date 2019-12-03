import * as moment from 'moment';

import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';
import {findExtensionPropertyByName} from './extension_property_parser';

export function parseUserTasks(processData: any): Array<Model.Activities.UserTask> {

  const userTasksRaw = getModelPropertyAsArray(processData, BpmnTags.TaskElement.UserTask);

  const noUserTasksFound = !(userTasksRaw?.length > 0);
  if (noUserTasksFound) {
    return [];
  }

  const userTasks = userTasksRaw.map(parseUserTask);

  return userTasks;
}

function parseUserTask(userTaskRaw: any): Model.Activities.UserTask {
  const userTask = createActivityInstance(userTaskRaw, Model.Activities.UserTask);

  userTask.assignee = userTaskRaw[BpmnTags.CamundaProperty.Assignee];
  userTask.candidateUsers = userTaskRaw[BpmnTags.CamundaProperty.CandidateUsers];
  userTask.candidateGroups = userTaskRaw[BpmnTags.CamundaProperty.CandidateGroups];
  userTask.formFields = parseFormFields(userTaskRaw);
  userTask.dueDate = parseDate(userTaskRaw[BpmnTags.CamundaProperty.DueDate]);
  userTask.followUpDate = parseDate(userTaskRaw[BpmnTags.CamundaProperty.FollowupDate]);
  setPreferredControlForUserTask(userTask);
  setDescriptionForUserTask(userTask);
  setFinishedMessageForUserTask(userTask);

  return userTask;
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

  return formFieldsRaw.map(parseFormField);
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
  const notAValidDate = !(value?.length > 0) || !moment(value, 'YYYY-MM-DDTHH:mm:ss', true).isValid();
  if (notAValidDate) {
    return undefined;
  }

  return moment(value).toDate();
}

function setPreferredControlForUserTask(userTask: Model.Activities.UserTask): void {
  userTask.preferredControl = findExtensionPropertyByName('preferredControl', userTask.extensionElements.camundaExtensionProperties)?.value;
}

function setDescriptionForUserTask(userTask: Model.Activities.UserTask): void {
  userTask.description = findExtensionPropertyByName('description', userTask.extensionElements.camundaExtensionProperties)?.value;
}

function setFinishedMessageForUserTask(userTask: Model.Activities.UserTask): void {
  userTask.finishedMessage = findExtensionPropertyByName('finishedMessage', userTask.extensionElements.camundaExtensionProperties)?.value;
}
