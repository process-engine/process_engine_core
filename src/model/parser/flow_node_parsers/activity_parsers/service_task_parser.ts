import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';
import {findExtensionPropertyByName} from './extension_property_parser';

export function parseServiceTasks(processData: any): Array<Model.Activities.ServiceTask> {

  const serviceTasks: Array<Model.Activities.ServiceTask> = [];

  const serviceTasksRaw = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ServiceTask);

  const noServiceTasksFound = !serviceTasksRaw || serviceTasksRaw.length === 0;
  if (noServiceTasksFound) {
    return [];
  }

  for (const serviceTaskRaw of serviceTasksRaw) {
    const serviceTask = createActivityInstance(serviceTaskRaw, Model.Activities.ServiceTask);

    const isExternalTask = serviceTaskRaw[BpmnTags.CamundaProperty.Type] === 'external';
    if (isExternalTask) {

      serviceTask.type = Model.Activities.ServiceTaskType.external;
      serviceTask.topic = serviceTaskRaw[BpmnTags.CamundaProperty.Topic];
      serviceTask.payload = getPayloadForExternalTask(serviceTask);
    } else {

      serviceTask.type = Model.Activities.ServiceTaskType.internal;

      // Check if the extension properties contain invocations.
      if (serviceTask.extensionElements &&
        serviceTask.extensionElements.camundaExtensionProperties &&
        serviceTask.extensionElements.camundaExtensionProperties.length > 0) {

        const invocation = getMethodInvocationforInternalServiceTask(serviceTask);

        if (invocation) {
          serviceTask.invocation = invocation;
        }
      }
    }

    serviceTasks.push(serviceTask);
  }

  return serviceTasks;
}

function getPayloadForExternalTask(serviceTask: Model.Activities.ServiceTask): string {

  const serviceTaskHasNoExtensionProperties =
    !serviceTask.extensionElements ||
    !serviceTask.extensionElements.camundaExtensionProperties ||
    serviceTask.extensionElements.camundaExtensionProperties.length === 0;

  if (serviceTaskHasNoExtensionProperties) {
    return undefined;
  }

  const extensionProperties = serviceTask.extensionElements.camundaExtensionProperties;
  const payloadProperty = findExtensionPropertyByName('payload', extensionProperties);

  const payloadPropertyHasValue = payloadProperty && payloadProperty.value && payloadProperty.value.length > 0;

  return payloadPropertyHasValue ? payloadProperty.value : undefined;
}

function getMethodInvocationforInternalServiceTask(serviceTask: Model.Activities.ServiceTask): Model.Activities.Invocations.Invocation {

  const extensionProperties = serviceTask.extensionElements.camundaExtensionProperties;

  const methodInvocation = new Model.Activities.Invocations.MethodInvocation();

  const moduleProperty = findExtensionPropertyByName('module', extensionProperties);
  const methodProperty = findExtensionPropertyByName('method', extensionProperties);
  const paramsProperty = findExtensionPropertyByName('params', extensionProperties);

  // 'params' is optional on MethodInvocations, so we don't need to check them here.
  const isNotValidMethodInvocation = !moduleProperty || !methodProperty;
  if (isNotValidMethodInvocation) {
    return undefined;
  }

  methodInvocation.module = moduleProperty.value;
  methodInvocation.method = methodProperty.value;
  methodInvocation.params = paramsProperty ? paramsProperty.value : '[]';

  return methodInvocation;
}
