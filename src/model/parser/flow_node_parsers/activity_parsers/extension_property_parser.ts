import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

export function getValueFromExtensionProperty(name: string, rawFlowNode: any): string {
  const extensionElements = rawFlowNode[BpmnTags.FlowElementProperty.ExtensionElements];

  if (!extensionElements) {
    return undefined;
  }

  const extensionPropertiesDataRaw = extensionElements[BpmnTags.CamundaProperty.Properties];

  const extensionPropertiesAreEmpty = extensionPropertiesDataRaw === undefined || extensionPropertiesDataRaw.length < 1;
  if (extensionPropertiesAreEmpty) {
    return undefined;
  }

  const extensionPropertyRaw = extensionPropertiesDataRaw[BpmnTags.CamundaProperty.Property];

  const extensionPropertyIsEmpty = extensionPropertyRaw === undefined || extensionPropertyRaw.length < 1;
  if (extensionPropertyIsEmpty) {
    return undefined;
  }

  const extensionProperties = parseExtensionProperties(extensionPropertyRaw);
  const extensionProperty = findExtensionPropertyByName(name, extensionProperties);

  return extensionProperty !== undefined
    ? extensionProperty.value
    : undefined;
}

export function parseExtensionProperties(extensionPropertiesRaw: any): any {
  const extensionProperties: Array<Model.Base.Types.CamundaExtensionProperty> = [];

  if (!Array.isArray(extensionPropertiesRaw)) {
    return [{
      name: extensionPropertiesRaw.name,
      value: extensionPropertiesRaw.value,
    }];
  }

  for (const extensionPropertyRaw of extensionPropertiesRaw) {
    const extensionProperty: Model.Base.Types.CamundaExtensionProperty = {
      name: extensionPropertyRaw.name,
      value: extensionPropertyRaw.value,
    };

    extensionProperties.push(extensionProperty);
  }

  return extensionProperties;
}

export function findExtensionPropertyByName(
  propertyName: string,
  extensionProperties: Array<Model.Base.Types.CamundaExtensionProperty>,
): Model.Base.Types.CamundaExtensionProperty {

  return extensionProperties.find((property: Model.Base.Types.CamundaExtensionProperty): boolean => {
    return property.name === propertyName;
  });
}
