import * as moment from 'moment';

import {BpmnTags, Model} from '@process-engine/process_model.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';

export function parseUserTasks(processData: any): Array<Model.Activities.UserTask> {

  const userTasks: Array<Model.Activities.UserTask> = [];

  const userTasksRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.UserTask);

  if (!userTasksRaw || userTasksRaw.length === 0) {
    return [];
  }

  for (const userTaskRaw of userTasksRaw) {
    const userTask: Model.Activities.UserTask = createActivityInstance(userTaskRaw, Model.Activities.UserTask);

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

    const extensionElements: any = userTaskRaw[BpmnTags.FlowElementProperty.ExtensionElements];
    if (!extensionElements) {
      return [];
    }

    const formDataRaw: any = extensionElements[BpmnTags.CamundaProperty.FormData];
    if (!formDataRaw) {
      return [];
    }

    const formFieldsRaw: any = getModelPropertyAsArray(formDataRaw, BpmnTags.CamundaProperty.FormField);
    if (!formFieldsRaw) {
      return [];
    }

    const formFields: Array<Model.Activities.Types.UserTaskFormField> = [];

    for (const formFieldRaw of formFieldsRaw) {
      const formField: Model.Activities.Types.UserTaskFormField = parseFormField(formFieldRaw);
      formFields.push(formField);
    }

    return formFields;
  }

  function parseFormField(formFieldRaw: any): Model.Activities.Types.UserTaskFormField {

    const formField: Model.Activities.Types.UserTaskFormField = new Model.Activities.Types.UserTaskFormField();

    formField.id = formFieldRaw.id;
    formField.label = formFieldRaw.label;
    formField.type = formFieldRaw.type;
    formField.defaultValue = formFieldRaw.defaultValue;
    formField.preferredControl = formFieldRaw.preferredControl;

    if (formField.type === 'enum') {
      const rawValues: Array<any> = getModelPropertyAsArray(formFieldRaw, BpmnTags.CamundaProperty.Value);

      const valueMapper: any = (enumValueRaw: any): Model.Activities.Types.FormFieldEnumValue => {
        const enumValue: Model.Activities.Types.FormFieldEnumValue = new Model.Activities.Types.FormFieldEnumValue();
        enumValue.id = enumValueRaw.id;
        enumValue.name = enumValueRaw.name;

        return enumValue;
      };
      formField.enumValues = rawValues ? rawValues.map(valueMapper) : [];
    }

    return formField;
  }

  function parseDate(value: string): Date {

    if (!value || value.length === 0 || !moment(value, 'YYYY-MM-DDTHH:mm:ss', true).isValid()) {
      return undefined;
    }

    const dateObj: moment.Moment = moment(value);

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

function getValueFromExtensionProperty(name: string, userTaskRaw: Model.Activities.UserTask): string {
  const extensionElements: any = userTaskRaw[BpmnTags.FlowElementProperty.ExtensionElements];

  const extensionElementsIsNotExisting: boolean = extensionElements === undefined;
  if (extensionElementsIsNotExisting) {
    return;
  }

  const extensionPropertiesDataRaw: any = extensionElements[BpmnTags.CamundaProperty.Properties];

  const extensionPropertiesDataIsNotExisting: boolean =
    extensionPropertiesDataRaw === undefined || extensionPropertiesDataRaw.length < 1;

  if (extensionPropertiesDataIsNotExisting) {
    return;
  }

  const extensionPropertiesRaw: any = extensionPropertiesDataRaw[BpmnTags.CamundaProperty.Property];

  const extensionPropertiesAreNotExisting: boolean =
    extensionPropertiesRaw === undefined || extensionPropertiesRaw.length < 1;

  if (extensionPropertiesAreNotExisting) {
    return;
  }

  const extensionProperties: any = parseExtensionProperties(extensionPropertiesRaw);
  const preferredControlProperty: Model.Base.Types.CamundaExtensionProperty = findExtensionPropertyByName(name, extensionProperties);

  const preferredControlPropertyIsNotExisting: boolean = preferredControlProperty === undefined;
  if (preferredControlPropertyIsNotExisting) {
    return;
  }

  return preferredControlProperty.value;
}

function findExtensionPropertyByName(
  propertyName: string,
  extensionProperties: Array<Model.Base.Types.CamundaExtensionProperty>,
): Model.Base.Types.CamundaExtensionProperty {

  return extensionProperties.find((property: Model.Base.Types.CamundaExtensionProperty): boolean => {
    return property.name === propertyName;
  });
}

function parseExtensionProperties(extensionPropertiesRaw: any): any {
  const extensionProperties: Array<Model.Base.Types.CamundaExtensionProperty> = [];

  const extensionPropertiesIsNoArray: boolean = !Array.isArray(extensionPropertiesRaw);
  if (extensionPropertiesIsNoArray) {
    return [{
      name: extensionPropertiesRaw.name,
      value: extensionPropertiesRaw.value,
    }];
  }

  for (const extensionPropertyRaw of extensionPropertiesRaw) {
    const extensionProperty: Model.Base.Types.CamundaExtensionProperty = {
      name: extensionPropertyRaw.name,
      value: extensionPropertyRaw.value,
    };

    extensionProperties.push(extensionProperty);
  }

  return extensionProperties;
}
