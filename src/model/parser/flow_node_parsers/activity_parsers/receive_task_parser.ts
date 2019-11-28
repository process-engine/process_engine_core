import {UnprocessableEntityError} from '@essential-projects/errors_ts';

import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';

export function parseReceiveTasks(
  processData: any,
  eventDefinitions: Array<Model.Events.Definitions.EventDefinition>,
): Array<Model.Activities.ReceiveTask> {

  const receiveTasksRaw = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ReceiveTask);

  const noReceiveTasksFound = !(receiveTasksRaw?.length > 0);
  if (noReceiveTasksFound) {
    return [];
  }

  const receiveTasks = receiveTasksRaw.map((receiveTaskRaw): Model.Activities.ReceiveTask => {
    const receiveTask = createActivityInstance(receiveTaskRaw, Model.Activities.ReceiveTask);

    if (!receiveTaskRaw.messageRef) {
      throw new UnprocessableEntityError(`ReceiveTask ${receiveTaskRaw.id} does not have a messageRef!`);
    }

    receiveTask.messageEventDefinition = <Model.Events.MessageEventDefinition>
      eventDefinitions.find((entry): boolean => entry.id === receiveTaskRaw.messageRef);

    return receiveTask;
  });

  return receiveTasks;
}
