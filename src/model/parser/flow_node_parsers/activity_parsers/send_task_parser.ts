import {UnprocessableEntityError} from '@essential-projects/errors_ts';

import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';
import {findExtensionPropertyByName} from './extension_property_parser';

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

    const configuredRetryInterval = findExtensionPropertyByName('retryInvervalInMs', sendTask.extensionElements.camundaExtensionProperties)?.value;
    const configuredMaxRetries = findExtensionPropertyByName('maxRetries', sendTask.extensionElements.camundaExtensionProperties)?.value;

    sendTask.retryIntervalInMs = configuredRetryInterval ? parseInt(configuredRetryInterval) : 500;
    sendTask.maxRetries = configuredMaxRetries ? parseInt(configuredMaxRetries) : -1;

    sendTask.messageEventDefinition = <Model.Events.MessageEventDefinition> eventDefinitions.find((entry) => entry.id === sendTaskRaw.messageRef);

    return sendTask;
  });

  return sendTasks;
}
