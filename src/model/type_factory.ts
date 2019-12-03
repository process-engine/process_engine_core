import {UnprocessableEntityError} from '@essential-projects/errors_ts';

import {BpmnTags, Model} from '@process-engine/persistence_api.contracts';

/**
 * Retrieves an element from the given raw ProcessModel data.
 * Returns undefined, if the element does not exist.
 *
 * @param   rawProcessModel The raw ProcessModel from which to extract an element.
 * @param   elementName     The name of the element to extract.
 * @returns                 The extracted element, or undefined if it doesn't exist.
 */
export function getModelPropertyAsArray(rawProcessModel: any, elementName: string): any {

  if (!rawProcessModel[elementName]) {
    return undefined;
  }

  const modelElement = rawProcessModel[elementName];

  if (Array.isArray(modelElement)) {
    return modelElement;
  }

  if (typeof modelElement === 'string') {
    return [modelElement.trim()];
  }

  return [modelElement];
}

/**
 * Uses the given raw data to create an instance of one of our own ProcessModel elements.
 * This can be any support element, like a Process, Collaboration, FlowNode, etc.
 *
 * @param   rawData    The raw data from which to create an instance.
 * @param   targetType A type that matches one of our own ProcessModel elements.
 * @returns            The created instance.
 */
export function createObjectWithCommonProperties<TTargetType extends Model.Base.BaseElement>(
  rawData: any,
  targetType: Model.Base.IConstructor<TTargetType>,
): TTargetType {

  // eslint-disable-next-line 6river/new-cap
  let instance = new targetType();
  instance = <TTargetType> setCommonObjectPropertiesFromData(rawData, instance);

  return instance;
}

/**
 * Takes the given instance of one of our own ProcessModel elements and fills
 * out all the properties that are common for every BPMN element
 * (ID, documentation, etc), using the given raw data as a baseline.
 *
 * @param   rawData  The raw data from which to get the values.
 * @param   instance The instance for which to set the common properties.
 * @returns          The updated instance.
 */
export function setCommonObjectPropertiesFromData(rawData: any, instance: Model.Base.BaseElement): Model.Base.BaseElement {

  if (!rawData.id) {
    const error = new UnprocessableEntityError('The given element has no ID!');
    error.additionalInformation = {
      rawDataToParse: rawData,
      elementInstance: instance,
    };
    throw error;
  }

  instance.id = rawData.id;

  if (rawData[BpmnTags.FlowElementProperty.Documentation]) {
    instance.documentation = [rawData[BpmnTags.FlowElementProperty.Documentation]];
  }

  instance.extensionElements = new Model.Base.Types.ExtensionElements();

  if (rawData[BpmnTags.FlowElementProperty.ExtensionElements]) {
    const extensionData = rawData[BpmnTags.FlowElementProperty.ExtensionElements];
    instance.extensionElements.camundaExecutionListener = extensionData[BpmnTags.CamundaProperty.ExecutionListener];

    // NOTE: The extension property collection is wrapped in a property named "camunda:property", which in turn is located in "camunda:properties".
    const camundaProperties = filterOutEmptyProperties(extensionData[BpmnTags.CamundaProperty.Properties]);

    if (camundaProperties != undefined) {
      instance.extensionElements.camundaExtensionProperties = getModelPropertyAsArray(camundaProperties, BpmnTags.CamundaProperty.Property);
    }
  }

  return instance;
}

/**
 * This is supposed to address the issue, where empty camunda:properties tags will cause
 * unexpected behavior when executing a process model.
 * For instance, a service task's invocation would not be usable, or a UserTask's FormFields could
 * not be addressed.
 *
 * This function takes a list of camunda properties and filters out all empty ones.
 * Depending on what is left afterwards, we will get either a single value, an Array, or nothing.
 *
 * @param camundaProperties The property list to filter.
 */
function filterOutEmptyProperties(camundaProperties: any): any {

  // Filter out strings etc, because these are not valid for the 'camunda:properties' tag.
  if (!Array.isArray(camundaProperties)) {
    return typeof camundaProperties === 'object' ? camundaProperties : undefined;
  }

  const filteredProperties = camundaProperties.filter((property: any): boolean => {

    if (property == undefined) {
      return false;
    }

    let hasValue = false;

    if (typeof property === 'object') {
      hasValue = Object.keys(property).length > 0;
    } else if (Array.isArray(property)) {
      hasValue = property.length > 0;
    }

    return hasValue;
  });

  if (filteredProperties.length === 0) {
    // No properties were declared, so don't bother returning anything.
    return undefined;
  }

  // Only one collection of properties should remain after filtering. Otherwise, the XML is broken.
  if (filteredProperties.length > 1) {
    const error = new UnprocessableEntityError('The XML contains more than one camunda:properties collection! This is not allowed!');
    error.additionalInformation = {
      propertyCollection: filteredProperties,
    };

    throw error;
  }

  return filteredProperties[0];
}
