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

  return Array.prototype.concat(manualTasks, scriptTasks, serviceTasks, userTasks);
}

function parseManualTasks(processData: any): Array<Model.Activities.ManualTask> {

  const manualTasks: Array<Model.Activities.ManualTask> = [];

  const manualTasksRaw: Array<Model.Activities.ManualTask> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ManualTask);

  if (!manualTasksRaw || manualTasksRaw.length === 0) {
    return [];
  }

  manualTasksRaw.forEach((manualTaskRaw: any): void => {
    const manualTask: Model.Activities.ManualTask = createObjectWithCommonProperties(manualTaskRaw, Model.Activities.ManualTask);

    manualTask.incoming = getModelPropertyAsArray(manualTaskRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    manualTask.outgoing = getModelPropertyAsArray(manualTaskRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    manualTask.name = manualTaskRaw.name;

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
    const userTask: Model.Activities.UserTask = createObjectWithCommonProperties(userTaskRaw, Model.Activities.UserTask);

    userTask.incoming = getModelPropertyAsArray(userTaskRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    userTask.outgoing = getModelPropertyAsArray(userTaskRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    userTask.name = userTaskRaw.name;
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
    const scriptTask: Model.Activities.ScriptTask = createObjectWithCommonProperties(scriptTaskRaw, Model.Activities.ScriptTask);

    scriptTask.incoming = getModelPropertyAsArray(scriptTaskRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    scriptTask.outgoing = getModelPropertyAsArray(scriptTaskRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    scriptTask.name = scriptTaskRaw.name;
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
    const serviceTask: Model.Activities.ServiceTask = createObjectWithCommonProperties(serviceTaskRaw, Model.Activities.ServiceTask);

    serviceTask.incoming = getModelPropertyAsArray(serviceTaskRaw, BpmnTags.FlowElementProperty.SequenceFlowIncoming);
    serviceTask.outgoing = getModelPropertyAsArray(serviceTaskRaw, BpmnTags.FlowElementProperty.SequenceFlowOutgoing);

    serviceTask.name = serviceTaskRaw.name;

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
