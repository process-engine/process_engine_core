import {BpmnTags, Model} from '@process-engine/process_model.contracts';

import {getModelPropertyAsArray} from '../../../type_factory';
import {createActivityInstance} from './activity_factory';

export function parseServiceTasks(processData: any): Array<Model.Activities.ServiceTask> {

  const serviceTasks: Array<Model.Activities.ServiceTask> = [];

  const serviceTasksRaw: Array<any> = getModelPropertyAsArray(processData, BpmnTags.TaskElement.ServiceTask);

  if (!serviceTasksRaw || serviceTasksRaw.length === 0) {
    return [];
  }

  for (const serviceTaskRaw of serviceTasksRaw) {
    const serviceTask: Model.Activities.ServiceTask = createActivityInstance(serviceTaskRaw, Model.Activities.ServiceTask);

    const isExternalTask: boolean = serviceTaskRaw[BpmnTags.CamundaProperty.Type] === 'external';
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

        const invocation: Model.Activities.Invocations.Invocation = getInvocationForServiceTask(serviceTask);

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

  if (
    serviceTask.extensionElements &&
    serviceTask.extensionElements.camundaExtensionProperties &&
    serviceTask.extensionElements.camundaExtensionProperties.length > 0) {

    const extensionProperties: Array<Model.Base.Types.CamundaExtensionProperty> = serviceTask.extensionElements.camundaExtensionProperties;
    const payloadProperty: Model.Base.Types.CamundaExtensionProperty = findExtensionPropertyByName('payload', extensionProperties);

    const payloadPropertyHasValue: boolean = payloadProperty && payloadProperty.value && payloadProperty.value.length > 0;

    if (payloadPropertyHasValue) {

      return payloadProperty.value;
    }
  }

  return undefined;
}

function getInvocationForServiceTask(serviceTask: Model.Activities.ServiceTask): Model.Activities.Invocations.Invocation {

  const extensionParameters: Array<Model.Base.Types.CamundaExtensionProperty> = serviceTask.extensionElements.camundaExtensionProperties;

  return getMethodInvocation(extensionParameters);
}

function getMethodInvocation(extensionProperties: Array<Model.Base.Types.CamundaExtensionProperty>): Model.Activities.Invocations.MethodInvocation {

  const methodInvocation: Model.Activities.Invocations.MethodInvocation = new Model.Activities.Invocations.MethodInvocation();

  const moduleProperty: Model.Base.Types.CamundaExtensionProperty = findExtensionPropertyByName('module', extensionProperties);
  const methodProperty: Model.Base.Types.CamundaExtensionProperty = findExtensionPropertyByName('method', extensionProperties);
  const paramsProperty: Model.Base.Types.CamundaExtensionProperty = findExtensionPropertyByName('params', extensionProperties);

  // If no module- or method- property is defined, this is not a valid method invocation. 'params' are optional.
  if (!moduleProperty || !methodProperty) {
    return undefined;
  }

  methodInvocation.module = moduleProperty.value;
  methodInvocation.method = methodProperty.value;
  methodInvocation.params = paramsProperty ? paramsProperty.value : '[]';

  return methodInvocation;
}

function findExtensionPropertyByName(
  propertyName: string,
  extensionProperties: Array<Model.Base.Types.CamundaExtensionProperty>,
): Model.Base.Types.CamundaExtensionProperty {

  return extensionProperties.find((property: Model.Base.Types.CamundaExtensionProperty): boolean => {
    return property.name === propertyName;
  });
}
