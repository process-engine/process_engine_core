import {BpmnTags, Model} from '@process-engine/process_engine_contracts';

export function getModelPropertyAsArray(model: any, elementName: string): any {

  if (!model[elementName]) {
    return undefined;
  }

  const modelElement: any = model[elementName];

  if (Array.isArray(modelElement)) {
    return modelElement;
  }

  if (typeof modelElement === 'string') {
    return [modelElement.trim()];
  }

  return [modelElement];
}

export function createObjectWithCommonProperties<TTargetType extends Model.Base.BaseElement>(
    data: any,
    type: Model.Base.IConstructor<TTargetType>,
  ): TTargetType {

    let instance: TTargetType = new type();
    instance = <TTargetType> setCommonObjectPropertiesFromData(data, instance);

    return instance;
  }

export function setCommonObjectPropertiesFromData(data: any, instance: Model.Base.BaseElement): Model.Base.BaseElement {

  instance.id = data.id;

  if (data[BpmnTags.FlowElementProperty.Documentation]) {
    instance.documentation = [data[BpmnTags.FlowElementProperty.Documentation]];
  }

  if (data[BpmnTags.FlowElementProperty.ExtensionElements]) {

    const extensionData: any = data[BpmnTags.FlowElementProperty.ExtensionElements];

    instance.extensionElements = new Model.Base.ExtensionElements();
    instance.extensionElements.camundaExecutionListener = extensionData[BpmnTags.CamundaProperty.ExecutionListener];

    // NOTE: The extension property collection is wrapped in a property named "camunda:property",
    // which in turn is located in "camunda:properties".
    let camundaProperties: any = extensionData[BpmnTags.CamundaProperty.Properties];

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
 * This is supposed to address the issue, where empty camunda:property tags will cause
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

  if (!Array.isArray(camundaProperties)) {
    return camundaProperties;
  }

  const filteredProperties: Array<any> = camundaProperties.filter((property: any): boolean => {
    const isNotEmpty: boolean = property !== undefined;

    let hasValue: boolean = false;

    if (typeof property === 'string') {
      hasValue = isNotEmpty && property.length > 0;
    } else if (typeof property === 'object') {
      hasValue = isNotEmpty && Object.keys(property).length > 0;
    } else if (Array.isArray(property)) {
      hasValue = isNotEmpty && property.length > 0;
    }

    return hasValue;
  });

  if (filteredProperties.length === 0) {
    // No properties were declared, so don't bother returning anything.
    return undefined;
  }

  if (filteredProperties.length === 1) {
    // Usually, when only a single property is declared on an element,
    // the parsed result would look something like this:
    //
    // { 'camunda:properties': 'someValue' }
    //
    // Since we have an Array here, we need to return that value specifically,
    // in order to keep the ProcessModel's structure intact.
    return filteredProperties[0];
  }

  // More than one property was declared, so return the Array as it is.
  return filteredProperties;
}
