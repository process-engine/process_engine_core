import {BpmnTags, Model} from '@process-engine/process_engine_contracts';

export function getModelPropertyAsArray(model: any, elementName: string): any {

  if (!model[elementName]) {
    return undefined;
  }

  return Array.isArray(model[elementName]) ? model[elementName] : [model[elementName]];
}

export function createObjectWithCommonProperties<TTargetType extends Model.Base.BaseElement>(
    data: any, type: Model.Base.IConstructor<TTargetType>): TTargetType {

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
    const propertyCollection: any = extensionData[BpmnTags.CamundaProperty.Properties];

    // This covers all properties defined in the Extensions-Panel (mapper, module/method/param, etc).
    instance.extensionElements.camundaExtensionProperties =
      getModelPropertyAsArray(propertyCollection, BpmnTags.CamundaProperty.Property);
  }

  return instance;
}
