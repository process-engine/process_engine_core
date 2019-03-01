import {BpmnTags, Model} from '@process-engine/process_model.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';

export function parseScriptTasks(processData: any): Array<Model.Activities.ScriptTask> {

  const scriptTasks: Array<Model.Activities.ScriptTask> = [];

  const scriptTasksRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ScriptTask);

  const noScriptTasksFound: boolean = !scriptTasksRaw || scriptTasksRaw.length === 0;
  if (noScriptTasksFound) {
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
