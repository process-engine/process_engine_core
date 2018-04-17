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

  return new Array<Model.Activities.ManualTask>();
}

function parseScriptTasks(processData: any): Array<Model.Activities.ScriptTask> {

  return new Array<Model.Activities.ScriptTask>();
}

function parseServiceTasks(processData: any): Array<Model.Activities.ServiceTask> {

  return new Array<Model.Activities.ServiceTask>();
}

function parseUserTasks(processData: any): Array<Model.Activities.UserTask> {

  return new Array<Model.Activities.UserTask>();
}
