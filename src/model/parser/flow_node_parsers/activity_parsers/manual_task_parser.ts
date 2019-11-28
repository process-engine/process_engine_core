import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';

export function parseManualTasks(processData: any): Array<Model.Activities.ManualTask> {

  const manualTasks: Array<Model.Activities.ManualTask> = [];

  const manualTasksRaw = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ManualTask);

  const noManualTasksFound = !(manualTasksRaw?.length > 0);
  if (noManualTasksFound) {
    return [];
  }

  for (const manualTaskRaw of manualTasksRaw) {
    const manualTask = createActivityInstance(manualTaskRaw, Model.Activities.ManualTask);
    manualTasks.push(manualTask);
  }

  return manualTasks;
}
