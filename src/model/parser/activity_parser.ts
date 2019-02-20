import * as moment from 'moment';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';
import {BpmnTags, Model} from '@process-engine/process_model.contracts';

import {
  getModelPropertyAsArray,
  setCommonObjectPropertiesFromData,
} from '../type_factory';

import {parseProcessFlowNodes} from './flow_node_parser';
import {parseProcessLaneSet} from './process_lane_set_parser';
import {parseProcessSequenceFlows} from './sequence_flow_parser';

export function parseActivitiesFromProcessData(
  processData: any,
  errors: Array<Model.Types.Error>,
  eventDefinitions: Array<Model.EventDefinitions.EventDefinition>,
): Array<Model.Activities.Activity> {

  const manualTasks: Array<Model.Activities.ManualTask> = parseManualTasks(processData);
  const userTasks: Array<Model.Activities.UserTask> = parseUserTasks(processData);
  const scriptTasks: Array<Model.Activities.ScriptTask> = parseScriptTasks(processData);
  const serviceTasks: Array<Model.Activities.ServiceTask> = parseServiceTasks(processData);
  const callActivities: Array<Model.Activities.CallActivity> = parseCallActivities(processData);
  const subProcesses: Array<Model.Activities.SubProcess> = parseSubProcesses(processData, errors, eventDefinitions);
  const sendTasks: Array<Model.Activities.SendTask> = parseSendTasks(processData, eventDefinitions);
  const receiveTasks: Array<Model.Activities.ReceiveTask> = parseReceiveTasks(processData, eventDefinitions);

  return Array
    .prototype
    .concat(manualTasks, userTasks, scriptTasks, serviceTasks, callActivities, subProcesses, sendTasks, receiveTasks);
}

function parseManualTasks(processData: any): Array<Model.Activities.ManualTask> {

  const manualTasks: Array<Model.Activities.ManualTask> = [];

  const manualTasksRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ManualTask);

  if (!manualTasksRaw || manualTasksRaw.length === 0) {
    return [];
  }

  for (const manualTaskRaw of manualTasksRaw) {
    const manualTask: Model.Activities.ManualTask = createActivityInstance(manualTaskRaw, Model.Activities.ManualTask);
    manualTasks.push(manualTask);
  }

  return manualTasks;
}

function parseSendTasks(processData: any, eventDefinitions: Array<Model.EventDefinitions.EventDefinition>): Array<Model.Activities.SendTask> {
  const sendTasks: Array<Model.Activities.SendTask> = [];

  const sendTasksRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.SendTask);

  const noSendTasksFound: boolean = sendTasksRaw === undefined
    || sendTasksRaw === null
    || sendTasksRaw.length === 0;

  if (noSendTasksFound) {
    return sendTasks;
  }

  for (const currentRawSendTask of sendTasksRaw) {
    const sendTask: Model.Activities.SendTask = createActivityInstance(currentRawSendTask, Model.Activities.SendTask);

    const messageRefNotDefined: boolean = currentRawSendTask.messageRef === undefined;
    if (messageRefNotDefined) {
      throw new UnprocessableEntityError(`No message Reference for Send Task with id ${currentRawSendTask.id} given`);
    }

    const sendTaskMessageDefinition: Model.EventDefinitions.MessageEventDefinition =
      getDefinitionForEvent(currentRawSendTask.messageRef, eventDefinitions);

    sendTask.messageEventDefinition = sendTaskMessageDefinition;
    sendTasks.push(sendTask);
  }

  return sendTasks;
}

function parseReceiveTasks(processData: any, eventDefinitions: Array<Model.EventDefinitions.EventDefinition>): Array<Model.Activities.ReceiveTask> {
  const receiveTasks: Array<Model.Activities.ReceiveTask> = [];

  const receiveTasksRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ReceiveTask);

  const noReceiveTasksFound: boolean = receiveTasksRaw === undefined
    || receiveTasksRaw === null
    || receiveTasksRaw.length === 0;

  if (noReceiveTasksFound) {
    return receiveTasks;
  }

  for (const currentRawReceiveTask of receiveTasksRaw) {
    const receiveTask: Model.Activities.ReceiveTask = createActivityInstance(currentRawReceiveTask, Model.Activities.ReceiveTask);

    const messageRefNotDefined: boolean = currentRawReceiveTask.messageRef === undefined;
    if (messageRefNotDefined) {
      throw new UnprocessableEntityError(`No message Reference for Receive Task with id ${currentRawReceiveTask.id} given`);
    }

    const receiveTaskMessageDefinition: Model.EventDefinitions.MessageEventDefinition =
      getDefinitionForEvent(currentRawReceiveTask.messageRef, eventDefinitions);

    receiveTask.messageEventDefinition = receiveTaskMessageDefinition;
    receiveTasks.push(receiveTask);
  }

  return receiveTasks;
}

function parseUserTasks(processData: any): Array<Model.Activities.UserTask> {

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

  function parseFormFields(userTaskRaw: any): Array<Model.Types.FormField> {

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

    const formFields: Array<Model.Types.FormField> = [];

    for (const formFieldRaw of formFieldsRaw) {
      const formField: Model.Types.FormField = parseFormField(formFieldRaw);
      formFields.push(formField);
    }

    return formFields;
  }

  function parseFormField(formFieldRaw: any): Model.Types.FormField {

    const formField: Model.Types.FormField = new Model.Types.FormField();

    formField.id = formFieldRaw.id;
    formField.label = formFieldRaw.label;
    formField.type = formFieldRaw.type;
    formField.defaultValue = formFieldRaw.defaultValue;
    formField.preferredControl = formFieldRaw.preferredControl;

    if (formField.type === 'enum') {
      const rawValues: Array<any> = getModelPropertyAsArray(formFieldRaw, BpmnTags.CamundaProperty.Value);

      const valueMapper: any = (enumValueRaw: any): Model.Types.EnumValue => {
        const enumValue: Model.Types.EnumValue = new Model.Types.EnumValue();
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

function parseScriptTasks(processData: any): Array<Model.Activities.ScriptTask> {

  const scriptTasks: Array<Model.Activities.ScriptTask> = [];

  const scriptTasksRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ScriptTask);

  if (!scriptTasksRaw || scriptTasksRaw.length === 0) {
    return [];
  }

  for (const scriptTaskRaw of scriptTasksRaw) {
    const scriptTask: Model.Activities.ScriptTask = createActivityInstance(scriptTaskRaw, Model.Activities.ScriptTask);

    scriptTask.scriptFormat = scriptTaskRaw.scriptFormat;
    scriptTask.script = scriptTaskRaw[BpmnTags.FlowElementProperty.BpmnScript];
    scriptTask.resultVariable = scriptTaskRaw[BpmnTags.CamundaProperty.ResultVariable];

    scriptTasks.push(scriptTask);
  }

  return scriptTasks;
}

function parseServiceTasks(processData: any): Array<Model.Activities.ServiceTask> {

  const serviceTasks: Array<Model.Activities.ServiceTask> = [];

  const serviceTasksRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ServiceTask);

  if (!serviceTasksRaw || serviceTasksRaw.length === 0) {
    return [];
  }

  for (const serviceTaskRaw of serviceTasksRaw) {
    const serviceTask: Model.Activities.ServiceTask = createActivityInstance(serviceTaskRaw, Model.Activities.ServiceTask);

    const isExternalTask: boolean = serviceTaskRaw[BpmnTags.CamundaProperty.Type] === 'external';
    if (isExternalTask) {

      serviceTask.type = Model.Activities.ServiceTaskType.external;
      serviceTask.topic = serviceTaskRaw[BpmnTags.CamundaProperty.Topic];
      serviceTask.payload = getPayloadForExternalTask(serviceTask);
    } else {

      serviceTask.type = Model.Activities.ServiceTaskType.internal;

      // Check if the extension properties contain invocations.
      if (serviceTask.extensionElements &&
        serviceTask.extensionElements.camundaExtensionProperties &&
        serviceTask.extensionElements.camundaExtensionProperties.length > 0) {

        const invocation: Model.Activities.Invocation = getInvocationForServiceTask(serviceTask);

        if (invocation) {
          serviceTask.invocation = invocation;
        }
      }
    }

    serviceTasks.push(serviceTask);
  }

  return serviceTasks;
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
  const preferredControlProperty: Model.Base.CamundaExtensionProperty = findExtensionPropertyByName(name, extensionProperties);

  const preferredControlPropertyIsNotExisting: boolean = preferredControlProperty === undefined;
  if (preferredControlPropertyIsNotExisting) {
    return;
  }

  return preferredControlProperty.value;
}

function parseExtensionProperties(extensionPropertiesRaw: any): any {
  const extensionProperties: Array<Model.Base.CamundaExtensionProperty> = [];

  const extensionPropertiesIsNoArray: boolean = !Array.isArray(extensionPropertiesRaw);
  if (extensionPropertiesIsNoArray) {
    return [{
      name: extensionPropertiesRaw.name,
      value: extensionPropertiesRaw.value,
    }];
  }

  for (const extensionPropertyRaw of extensionPropertiesRaw) {
    const extensionProperty: Model.Base.CamundaExtensionProperty = {
      name: extensionPropertyRaw.name,
      value: extensionPropertyRaw.value,
    };

    extensionProperties.push(extensionProperty);
  }

  return extensionProperties;
}

function getPayloadForExternalTask(serviceTask: Model.Activities.ServiceTask): string {

  if (
    serviceTask.extensionElements &&
    serviceTask.extensionElements.camundaExtensionProperties &&
    serviceTask.extensionElements.camundaExtensionProperties.length > 0) {

    const extensionProperties: Array<Model.Base.CamundaExtensionProperty> = serviceTask.extensionElements.camundaExtensionProperties;
    const payloadProperty: Model.Base.CamundaExtensionProperty = findExtensionPropertyByName('payload', extensionProperties);

    const payloadPropertyHasValue: boolean = payloadProperty && payloadProperty.value && payloadProperty.value.length > 0;

    if (payloadPropertyHasValue) {

      return payloadProperty.value;
    }
  }

  return undefined;
}

function getInvocationForServiceTask(serviceTask: Model.Activities.ServiceTask): Model.Activities.Invocation {

  const extensionParameters: Array<Model.Base.CamundaExtensionProperty> = serviceTask.extensionElements.camundaExtensionProperties;

  return getMethodInvocation(extensionParameters);
}

function getMethodInvocation(extensionProperties: Array<Model.Base.CamundaExtensionProperty>): Model.Activities.MethodInvocation {

  const methodInvocation: Model.Activities.MethodInvocation = new Model.Activities.MethodInvocation();

  const moduleProperty: Model.Base.CamundaExtensionProperty = findExtensionPropertyByName('module', extensionProperties);
  const methodProperty: Model.Base.CamundaExtensionProperty = findExtensionPropertyByName('method', extensionProperties);
  const paramsProperty: Model.Base.CamundaExtensionProperty = findExtensionPropertyByName('params', extensionProperties);

  // If no module- or method- property is defined, this is not a valid method invocation. 'params' are optional.
  if (!moduleProperty || !methodProperty) {
    return undefined;
  }

  methodInvocation.module = moduleProperty.value;
  methodInvocation.method = methodProperty.value;
  methodInvocation.params = paramsProperty ? paramsProperty.value : '[]';

  return methodInvocation;
}

function findExtensionPropertyByName(
  propertyName: string,
  extensionProperties: Array<Model.Base.CamundaExtensionProperty>,
): Model.Base.CamundaExtensionProperty {

  return extensionProperties.find((property: Model.Base.CamundaExtensionProperty): boolean => {
    return property.name === propertyName;
  });
}

function parseCallActivities(processData: any): Array<Model.Activities.CallActivity> {

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

function parseSubProcesses(
  processData: any,
  errors: Array<Model.Types.Error>,
  eventDefinitions: Array<Model.EventDefinitions.EventDefinition>,
): Array<Model.Activities.SubProcess> {

  const subProcesses: Array<Model.Activities.SubProcess> = [];

  const subProcessesRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.SubProcess);

  if (!subProcessesRaw || subProcessesRaw.length === 0) {
    return [];
  }

  for (const subProcessRaw of subProcessesRaw) {
    const subProcess: Model.Activities.SubProcess = createActivityInstance(subProcessRaw, Model.Activities.SubProcess);

    subProcess.laneSet = parseProcessLaneSet(subProcessRaw);
    subProcess.flowNodes = parseProcessFlowNodes(subProcessRaw, errors, eventDefinitions);
    subProcess.sequenceFlows = parseProcessSequenceFlows(subProcessRaw);

    subProcesses.push(subProcess);
  }

  return subProcesses;
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

function createActivityInstance<TActivity extends Model.Activities.Activity>(data: any, type: Model.Base.IConstructor<TActivity>): TActivity {

  let instance: TActivity = new type();
  instance = <TActivity> setCommonObjectPropertiesFromData(data, instance);

  instance.incoming = getModelPropertyAsArray(data, BpmnTags.FlowElementProperty.SequenceFlowIncoming) || [];
  instance.outgoing = getModelPropertyAsArray(data, BpmnTags.FlowElementProperty.SequenceFlowOutgoing) || [];

  instance.name = data.name;

  return instance;
}

function getDefinitionForEvent<TEventDefinition extends Model.EventDefinitions.EventDefinition>(
  eventDefinitionId: string,
  eventDefinitions: Array<Model.EventDefinitions.EventDefinition>): TEventDefinition {

  const matchingEventDefintion: Model.EventDefinitions.EventDefinition =
    eventDefinitions.find((entry: Model.EventDefinitions.EventDefinition): boolean => {
      return entry.id === eventDefinitionId;
    });

  return <TEventDefinition> matchingEventDefintion;
  // tslint:disable-next-line:max-file-line-count
}
