import {BpmnTags, Model} from '@process-engine/process_model.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';

export function parseEmptyActivities(processData: any): Array<Model.Activities.EmptyActivity> {

  const emptyTasks: Array<Model.Activities.EmptyActivity> = [];

  const emptyTasksRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.EmptyActivity);

  if (!emptyTasksRaw || emptyTasksRaw.length === 0) {
    return [];
  }

  for (const emptyTaskRaw of emptyTasksRaw) {
    const emptyTask: Model.Activities.EmptyActivity = createActivityInstance(emptyTaskRaw, Model.Activities.EmptyActivity);
    emptyTasks.push(emptyTask);
  }

  return emptyTasks;
}
