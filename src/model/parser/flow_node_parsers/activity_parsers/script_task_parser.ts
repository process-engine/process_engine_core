import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';

export function parseScriptTasks(processData: any): Array<Model.Activities.ScriptTask> {

  const scriptTasksRaw = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ScriptTask);

  const noScriptTasksFound = !(scriptTasksRaw?.length > 0);
  if (noScriptTasksFound) {
    return [];
  }

  const scriptTasks = scriptTasksRaw.map((scriptTaskRaw: any): Model.Activities.ScriptTask => {
    const scriptTask = createActivityInstance(scriptTaskRaw, Model.Activities.ScriptTask);

    scriptTask.scriptFormat = scriptTaskRaw.scriptFormat;
    scriptTask.script = scriptTaskRaw[BpmnTags.FlowElementProperty.BpmnScript];
    scriptTask.resultVariable = scriptTaskRaw[BpmnTags.CamundaProperty.ResultVariable];

    return scriptTask;
  });

  return scriptTasks;
}
