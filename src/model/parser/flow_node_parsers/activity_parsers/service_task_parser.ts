import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';
import {findExtensionPropertyByName} from './extension_property_parser';

export function parseServiceTasks(processData: any): Array<Model.Activities.ServiceTask> {

  const serviceTasksRaw = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ServiceTask);

  const noServiceTasksFound = !(serviceTasksRaw?.length > 0);
  if (noServiceTasksFound) {
    return [];
  }

  const serviceTasks = serviceTasksRaw.map((serviceTaskRaw: any): Model.Activities.ServiceTask => {
    return serviceTaskRaw[BpmnTags.CamundaProperty.Type] === 'external'
      ? parseExternalServiceTask(serviceTaskRaw)
      : parseInternalServiceTask(serviceTaskRaw);
  });

  return serviceTasks;
}

function parseExternalServiceTask(serviceTaskRaw: any): Model.Activities.ServiceTask {
  const serviceTask = createActivityInstance(serviceTaskRaw, Model.Activities.ServiceTask);
  serviceTask.type = Model.Activities.ServiceTaskType.external;
  serviceTask.topic = serviceTaskRaw[BpmnTags.CamundaProperty.Topic];

  const extensionProperties = serviceTask.extensionElements?.camundaExtensionProperties ?? [];

  serviceTask.payload = findExtensionPropertyByName('payload', extensionProperties)?.value;

  return serviceTask;
}

function parseInternalServiceTask(serviceTaskRaw: any): Model.Activities.ServiceTask {
  const serviceTask = createActivityInstance(serviceTaskRaw, Model.Activities.ServiceTask);
  serviceTask.type = Model.Activities.ServiceTaskType.internal;
  serviceTask.invocation = getMethodInvocationforInternalServiceTask(serviceTask);

  return serviceTask;
}

function getMethodInvocationforInternalServiceTask(serviceTask: Model.Activities.ServiceTask): Model.Activities.Invocations.Invocation {

  const extensionProperties = serviceTask.extensionElements?.camundaExtensionProperties ?? [];

  const moduleProperty = findExtensionPropertyByName('module', extensionProperties);
  const methodProperty = findExtensionPropertyByName('method', extensionProperties);
  const paramsProperty = findExtensionPropertyByName('params', extensionProperties);

  // 'params' is optional.
  const notAValidMethodInvocation = !moduleProperty || !methodProperty;
  if (notAValidMethodInvocation) {
    return undefined;
  }

  const methodInvocation = new Model.Activities.Invocations.MethodInvocation();
  methodInvocation.module = moduleProperty.value;
  methodInvocation.method = methodProperty.value;
  methodInvocation.params = paramsProperty?.value ?? '[]';

  return methodInvocation;
}
