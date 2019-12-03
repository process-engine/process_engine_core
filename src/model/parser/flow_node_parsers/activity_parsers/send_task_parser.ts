import {UnprocessableEntityError} from '@essential-projects/errors_ts';

import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';

export function parseSendTasks(
  processData: any,
  eventDefinitions: Array<Model.Events.Definitions.EventDefinition>,
): Array<Model.Activities.SendTask> {

  const sendTasksRaw = getModelPropertyAsArray(processData, BpmnTags.TaskElement.SendTask);

  const noSendTasksFound = !(sendTasksRaw?.length > 0);
  if (noSendTasksFound) {
    return [];
  }

  const sendTasks = sendTasksRaw.map((sendTaskRaw): Model.Activities.SendTask => {
    const sendTask = createActivityInstance(sendTaskRaw, Model.Activities.SendTask);

    if (!sendTaskRaw.messageRef) {
      throw new UnprocessableEntityError(`SendTask ${sendTaskRaw.id} does not have a messageRef!`);
    }

    sendTask.messageEventDefinition = <Model.Events.MessageEventDefinition>
      eventDefinitions.find((entry): boolean => entry.id === sendTaskRaw.messageRef);

    return sendTask;
  });

  return sendTasks;
}
