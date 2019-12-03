import {Model} from '@process-engine/persistence_api.contracts';

export function findExtensionPropertyByName(
  propertyName: string,
  extensionProperties: Array<Model.Base.Types.CamundaExtensionProperty>,
): Model.Base.Types.CamundaExtensionProperty {
  return extensionProperties.find((property): boolean => property.name === propertyName);
}
