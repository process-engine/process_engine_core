import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';

export function parseEmptyActivities(processData: any): Array<Model.Activities.EmptyActivity> {

  const emptyActivities: Array<Model.Activities.EmptyActivity> = [];

  const emptyActivitiesRaw = getModelPropertyAsArray(processData, BpmnTags.TaskElement.EmptyActivity);

  const noEmptyActivitiesFound = !(emptyActivitiesRaw?.length > 0);
  if (noEmptyActivitiesFound) {
    return [];
  }

  for (const emptyActivityRaw of emptyActivitiesRaw) {
    const emptyActivity = createActivityInstance(emptyActivityRaw, Model.Activities.EmptyActivity);
    emptyActivities.push(emptyActivity);
  }

  return emptyActivities;
}
