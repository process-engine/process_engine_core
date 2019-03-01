import {BpmnTags, Model} from '@process-engine/process_model.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';

export function parseManualTasks(processData: any): Array<Model.Activities.ManualTask> {

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
