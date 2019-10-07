import {UnprocessableEntityError} from '@essential-projects/errors_ts';

import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';

export function parseSendTasks(
  processData: any,
  eventDefinitions: Array<Model.Events.Definitions.EventDefinition>,
): Array<Model.Activities.SendTask> {
  const sendTasks: Array<Model.Activities.SendTask> = [];

  const sendTasksRaw = getModelPropertyAsArray(processData, BpmnTags.TaskElement.SendTask);

  const noSendTasksFound = sendTasksRaw === undefined || sendTasksRaw.length === 0;
  if (noSendTasksFound) {
    return sendTasks;
  }

  for (const currentRawSendTask of sendTasksRaw) {
    const sendTask = createActivityInstance(currentRawSendTask, Model.Activities.SendTask);

    const messageRefNotDefined = currentRawSendTask.messageRef === undefined;
    if (messageRefNotDefined) {
      throw new UnprocessableEntityError(`No message Reference for Send Task with id ${currentRawSendTask.id} given`);
    }

    const sendTaskMessageDefinition =
      getDefinitionForEvent<Model.Events.Definitions.MessageEventDefinition>(currentRawSendTask.messageRef, eventDefinitions);

    sendTask.messageEventDefinition = sendTaskMessageDefinition;
    sendTasks.push(sendTask);
  }

  return sendTasks;
}

function getDefinitionForEvent<TEventDefinition extends Model.Events.Definitions.EventDefinition>(
  eventDefinitionId: string,
  eventDefinitions: Array<Model.Events.Definitions.EventDefinition>,
): TEventDefinition {

  const matchingEventDefintion = eventDefinitions.find((entry: Model.Events.Definitions.EventDefinition): boolean => {
    return entry.id === eventDefinitionId;
  });

  return <TEventDefinition> matchingEventDefintion;
}
