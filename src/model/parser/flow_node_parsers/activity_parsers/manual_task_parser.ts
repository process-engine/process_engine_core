import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';

export function parseManualTasks(processData: any): Array<Model.Activities.ManualTask> {

  const manualTasksRaw = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ManualTask);

  const noManualTasksFound = !(manualTasksRaw?.length > 0);
  if (noManualTasksFound) {
    return [];
  }

  const manualTasks = manualTasksRaw.map((manualTaskRaw): Model.Activities.ManualTask => {
    return createActivityInstance(manualTaskRaw, Model.Activities.ManualTask);
  });

  return manualTasks;
}
