import {BpmnTags, Model} from '@process-engine/process_engine_contracts';

import {
  createObjectWithCommonProperties,
  getModelPropertyAsArray,
  setCommonObjectPropertiesFromData,
} from '../type_factory';

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

function parseScriptTasks(processData: any): Array<Model.Activities.ScriptTask> {

  const scriptTasks: Array<Model.Activities.ScriptTask> = [];

  const scriptTasksRaw: Array<Model.Activities.ScriptTask> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ManualTask);

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
    scriptTask.resultVariable = scriptTaskRaw[BpmnTags.FlowElementProperty.CamundaResultVariable];

    scriptTasks.push(scriptTask);
  });

  return scriptTasks;
}

function parseServiceTasks(processData: any): Array<Model.Activities.ServiceTask> {

  return new Array<Model.Activities.ServiceTask>();
}

function parseUserTasks(processData: any): Array<Model.Activities.UserTask> {

  return new Array<Model.Activities.UserTask>();
}
