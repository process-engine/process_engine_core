import {BpmnTags, Model} from '@process-engine/process_model.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';

export function parseEmptyActivities(processData: any): Array<Model.Activities.EmptyActivity> {

  const emptyActivities: Array<Model.Activities.EmptyActivity> = [];

  const emptyActivitiesRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.EmptyActivity);

  if (!emptyActivitiesRaw || emptyActivitiesRaw.length === 0) {
    return [];
  }

  for (const emptyActivityRaw of emptyActivitiesRaw) {
    const emptyActivity: Model.Activities.EmptyActivity = createActivityInstance(emptyActivityRaw, Model.Activities.EmptyActivity);
    emptyActivities.push(emptyActivity);
  }

  return emptyActivities;
}
