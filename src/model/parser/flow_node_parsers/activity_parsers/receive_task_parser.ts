import {UnprocessableEntityError} from '@essential-projects/errors_ts';

import {BpmnTags, Model} from '@process-engine/process_model.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';

export function parseReceiveTasks(
  processData: any,
  eventDefinitions: Array<Model.Events.Definitions.EventDefinition>,
): Array<Model.Activities.ReceiveTask> {
  const receiveTasks: Array<Model.Activities.ReceiveTask> = [];

  const receiveTasksRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ReceiveTask);

  const noReceiveTasksFound: boolean = receiveTasksRaw === undefined || receiveTasksRaw.length === 0;
  if (noReceiveTasksFound) {
    return receiveTasks;
  }

  for (const currentRawReceiveTask of receiveTasksRaw) {
    const receiveTask: Model.Activities.ReceiveTask = createActivityInstance(currentRawReceiveTask, Model.Activities.ReceiveTask);

    const messageRefNotDefined: boolean = currentRawReceiveTask.messageRef === undefined;
    if (messageRefNotDefined) {
      throw new UnprocessableEntityError(`No message Reference for Receive Task with id ${currentRawReceiveTask.id} given`);
    }

    const receiveTaskMessageDefinition: Model.Events.Definitions.MessageEventDefinition =
      getDefinitionForEvent(currentRawReceiveTask.messageRef, eventDefinitions);

    receiveTask.messageEventDefinition = receiveTaskMessageDefinition;
    receiveTasks.push(receiveTask);
  }

  return receiveTasks;
}

function getDefinitionForEvent<TEventDefinition extends Model.Events.Definitions.EventDefinition>(
  eventDefinitionId: string,
  eventDefinitions: Array<Model.Events.Definitions.EventDefinition>,
): TEventDefinition {

  const matchingEventDefintion: Model.Events.Definitions.EventDefinition =
    eventDefinitions.find((entry: Model.Events.Definitions.EventDefinition): boolean => {
      return entry.id === eventDefinitionId;
    });

  return <TEventDefinition> matchingEventDefintion;
}
