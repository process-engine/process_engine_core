import {BpmnTags, Model} from '@process-engine/process_engine_contracts';

import {
  getModelPropertyAsArray,
  setCommonObjectPropertiesFromData,
} from '../type_factory';

import {parseProcessFlowNodes} from './flow_node_parser';
import {parseProcessLaneSet} from './process_lane_set_parser';
import {parseProcessSequenceFlows} from './sequence_flow_parser';

import * as moment from 'moment';

export function parseActivitiesFromProcessData(processData: any, errors: Array<Model.Types.Error>): Array<Model.Activities.Activity> {

  const manualTasks: Array<Model.Activities.ManualTask> = parseManualTasks(processData);
  const userTasks: Array<Model.Activities.UserTask> = parseUserTasks(processData);
  const scriptTasks: Array<Model.Activities.ScriptTask> = parseScriptTasks(processData);
  const serviceTasks: Array<Model.Activities.ServiceTask> = parseServiceTasks(processData);
  const callActivities: Array<Model.Activities.CallActivity> = parseCallActivities(processData);
  const subProcesses: Array<Model.Activities.SubProcess> = parseSubProcesses(processData, errors);

  return Array.prototype.concat(manualTasks,
                                userTasks,
                                scriptTasks,
                                serviceTasks,
                                callActivities,
                                subProcesses);
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
      formField.enumValues = rawValues.map(valueMapper);
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

    // Check if the extension properties contain invocations.
    if (serviceTask.extensionElements &&
        serviceTask.extensionElements.camundaExtensionProperties &&
        serviceTask.extensionElements.camundaExtensionProperties.length > 0) {

      const invocation: Model.Activities.Invocation = getInvocationForServiceTask(serviceTask);

      if (invocation) {
        serviceTask.invocation = getInvocationForServiceTask(serviceTask);
      }
    }

    serviceTasks.push(serviceTask);
  }

  return serviceTasks;
}

function getPreferredControlForUserTask(userTask: Model.Activities.UserTask): string {
  const extensionProperties: Array<Model.Base.CamundaExtensionProperty> = userTask.extensionElements.camundaExtensionProperties;
  const preferredControlProperty: Model.Base.CamundaExtensionProperty = findExtensionPropertyByName('preferredControl', extensionProperties);

  return preferredControlProperty.value;
}

function getInvocationForServiceTask(serviceTask: Model.Activities.ServiceTask): Model.Activities.Invocation {

  const extensionParameters: Array<Model.Base.CamundaExtensionProperty> = serviceTask.extensionElements.camundaExtensionProperties;

  const methodInvocation: Model.Activities.MethodInvocation = getMethodInvocationForServiceTask(extensionParameters);

  if (!methodInvocation) {
    return getServiceInvocationForServiceTask(extensionParameters);
  }

  return methodInvocation;
}

function getMethodInvocationForServiceTask(extensionProperties: Array<Model.Base.CamundaExtensionProperty>): Model.Activities.MethodInvocation {

  const methodInvocation: Model.Activities.MethodInvocation = new Model.Activities.MethodInvocation();

  const moduleProperty: Model.Base.CamundaExtensionProperty = findExtensionPropertyByName('module', extensionProperties);
  const methodProperty: Model.Base.CamundaExtensionProperty = findExtensionPropertyByName('method', extensionProperties);
  const paramsProperty: Model.Base.CamundaExtensionProperty = findExtensionPropertyByName('params', extensionProperties);

  // If no module- or method- property is defined, this is not a valid method invocation, although parameters are optional.
  if (!moduleProperty || !methodProperty) {
    return undefined;
  }

  methodInvocation.module = moduleProperty.value;
  methodInvocation.method = methodProperty.value;
  methodInvocation.params = paramsProperty ? paramsProperty.value : '[]';

  return methodInvocation;
}

function getServiceInvocationForServiceTask(extensionProperties: Array<Model.Base.CamundaExtensionProperty>): Model.Activities.WebServiceInvocation {

  const serviceInvocation: Model.Activities.WebServiceInvocation = new Model.Activities.WebServiceInvocation();

  const moduleProperty: Model.Base.CamundaExtensionProperty = findExtensionPropertyByName('service', extensionProperties);

  // If no service property is provided, this is not a valid web service invocation.
  if (!moduleProperty) {
    return undefined;
  }

  serviceInvocation.service = moduleProperty.value;

  return serviceInvocation;
}

function findExtensionPropertyByName(
  propertyName: string,
  extensionProperties: Array<Model.Base.CamundaExtensionProperty>): Model.Base.CamundaExtensionProperty {

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

function parseSubProcesses(processData: any, errors: Array<Model.Types.Error>): Array<Model.Activities.SubProcess> {

  const subProcesses: Array<Model.Activities.SubProcess> = [];

  const subProcessesRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.SubProcess);

  if (!subProcessesRaw || subProcessesRaw.length === 0) {
    return [];
  }

  for (const subProcessRaw of subProcessesRaw) {
    const subProcess: Model.Activities.SubProcess = createActivityInstance(subProcessRaw, Model.Activities.SubProcess);

    subProcess.laneSet = parseProcessLaneSet(subProcessRaw);
    subProcess.flowNodes = parseProcessFlowNodes(subProcessRaw, errors);
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

function createActivityInstance<TActivity extends Model.Activities.Activity>(
  data: any,
  type: Model.Base.IConstructor<TActivity>,
): TActivity {

  let instance: TActivity = new type();
  instance = <TActivity> setCommonObjectPropertiesFromData(data, instance);

  instance.incoming = getModelPropertyAsArray(data, BpmnTags.FlowElementProperty.SequenceFlowIncoming) || [];
  instance.outgoing = getModelPropertyAsArray(data, BpmnTags.FlowElementProperty.SequenceFlowOutgoing) || [];

  instance.name = data.name;

  return instance;
}
