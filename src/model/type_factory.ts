import {BpmnTags, Model} from '@process-engine/process_model.contracts';
import { UnprocessableEntityError } from '@essential-projects/errors_ts';

/**
 * Retrieves an element from the given raw ProcessModel data.
 *
 * @param   rawProcessModel The raw ProcessModel from which to extract an element.
 * @param   elementName     The name of the element to extract.
 * @returns                 The extracted element.
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
    const additionalInfo = {
      rawDataToParse: rawData,
      elementInstance: instance,
    };
    const error = new UnprocessableEntityError('The given element has no ID!');
    error.additionalInformation = additionalInfo as any;

    throw error;
  }

  instance.id = rawData.id;

  if (rawData[BpmnTags.FlowElementProperty.Documentation]) {
    instance.documentation = [rawData[BpmnTags.FlowElementProperty.Documentation]];
  }

  if (rawData[BpmnTags.FlowElementProperty.ExtensionElements]) {

    const extensionData = rawData[BpmnTags.FlowElementProperty.ExtensionElements];

    instance.extensionElements = new Model.Base.Types.ExtensionElements();
    instance.extensionElements.camundaExecutionListener = extensionData[BpmnTags.CamundaProperty.ExecutionListener];

    // NOTE: The extension property collection is wrapped in a property named "camunda:property",
    // which in turn is located in "camunda:properties".
    let camundaProperties = extensionData[BpmnTags.CamundaProperty.Properties];

    camundaProperties = filterOutEmptyProperties(camundaProperties);

    if (camundaProperties !== undefined) {

      // This covers all properties defined in the Extensions-Panel (mapper, module/method/param, etc).
      instance.extensionElements.camundaExtensionProperties =
        getModelPropertyAsArray(camundaProperties, BpmnTags.CamundaProperty.Property);
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
    return typeof camundaProperties === 'object'
      ? camundaProperties
      : undefined;
  }

  const filteredProperties = camundaProperties.filter((property: any): boolean => {
    const propertyIsEmpty = property === null || property === undefined;

    if (propertyIsEmpty) {
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

  if (filteredProperties.length === 1) {
    // Return only the one property that actually had a value.
    // In the original XML, that property would not have been contained in an Array anyway.
    return filteredProperties[0];
  }

  // More than one property was declared, so return the Array as it is.
  return filteredProperties;
}
