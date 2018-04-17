import {BpmnTags, Model} from '@process-engine/process_engine_contracts';

import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
  setCommonObjectPropertiesFromData,
} from '../type_factory';

import * as moment from 'moment';

export function parseActivitiesFromProcessData(processData: any): Array<Model.Activities.Activity> {

  const manualTasks: Array<Model.Activities.ManualTask> = parseManualTasks(processData);
  const scriptTasks: Array<Model.Activities.ScriptTask> = parseScriptTasks(processData);
  const serviceTasks: Array<Model.Activities.ServiceTask> = parseServiceTasks(processData);
  const userTasks: Array<Model.Activities.UserTask> = parseUserTasks(processData);
  const callActivities: Array<Model.Activities.CallActivity> = parseCallActivities(processData);

  return Array.prototype.concat(manualTasks, scriptTasks, serviceTasks, userTasks, callActivities);
}

function parseManualTasks(processData: any): Array<Model.Activities.ManualTask> {

  const manualTasks: Array<Model.Activities.ManualTask> = [];

  const manualTasksRaw: Array<Model.Activities.ManualTask> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ManualTask);

  if (!manualTasksRaw || manualTasksRaw.length === 0) {
    return [];
  }

  manualTasksRaw.forEach((manualTaskRaw: any): void => {
    const manualTask: Model.Activities.ManualTask = createActivityInstance(manualTaskRaw, Model.Activities.ManualTask);
    manualTasks.push(manualTask);
  });

  return manualTasks;
}

function parseUserTasks(processData: any): Array<Model.Activities.UserTask> {

  const userTasks: Array<Model.Activities.UserTask> = [];

  const userTasksRaw: Array<Model.Activities.UserTask> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.UserTask);

  if (!userTasksRaw || userTasksRaw.length === 0) {
    return [];
  }

  function parseDate(value: string): Date {

    if (!value || value.length === 0 || !moment(value, 'YYYY-MM-DDTHH:mm:ss', true).isValid()) {
      return undefined;
    }

    const dateObj: moment.Moment = moment(value);

    return dateObj.toDate();
  }

  userTasksRaw.forEach((userTaskRaw: any): void => {
    const userTask: Model.Activities.UserTask = createActivityInstance(userTaskRaw, Model.Activities.UserTask);

    userTask.assignee = userTaskRaw[BpmnTags.CamundaProperty.Assignee];
    userTask.candidateUsers = userTaskRaw[BpmnTags.CamundaProperty.CandidateUsers];
    userTask.candidateGroups = userTaskRaw[BpmnTags.CamundaProperty.CandidateGroups];
    userTask.dueDate = parseDate(userTaskRaw[BpmnTags.CamundaProperty.DueDate]);
    userTask.followUpDate = parseDate(userTaskRaw[BpmnTags.CamundaProperty.FollowupDate]);

    userTasks.push(userTask);
  });

  return userTasks;
}

function parseScriptTasks(processData: any): Array<Model.Activities.ScriptTask> {

  const scriptTasks: Array<Model.Activities.ScriptTask> = [];

  const scriptTasksRaw: Array<Model.Activities.ScriptTask> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ScriptTask);

  if (!scriptTasksRaw || scriptTasksRaw.length === 0) {
    return [];
  }

  scriptTasksRaw.forEach((scriptTaskRaw: any): void => {
    const scriptTask: Model.Activities.ScriptTask = createActivityInstance(scriptTaskRaw, Model.Activities.ScriptTask);

    scriptTask.scriptFormat = scriptTaskRaw.scriptFormat;
    scriptTask.script = scriptTaskRaw[BpmnTags.FlowElementProperty.BpmnScript];
    scriptTask.resultVariable = scriptTaskRaw[BpmnTags.CamundaProperty.ResultVariable];

    scriptTasks.push(scriptTask);
  });

  return scriptTasks;
}

function parseServiceTasks(processData: any): Array<Model.Activities.ServiceTask> {

  const serviceTasks: Array<Model.Activities.ServiceTask> = [];

  const serviceTasksRaw: Array<Model.Activities.ServiceTask> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ServiceTask);

  if (!serviceTasksRaw || serviceTasksRaw.length === 0) {
    return [];
  }

  serviceTasksRaw.forEach((serviceTaskRaw: any): void => {
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
  });

  return serviceTasks;
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

  const callActivitiesRaw: Array<Model.Activities.CallActivity> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.CallActivity);

  if (!callActivitiesRaw || callActivitiesRaw.length === 0) {
    return [];
  }

  callActivitiesRaw.forEach((callActivityRaw: any): void => {
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
  });

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
