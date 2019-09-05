import {
  BpmnTags,
  IParsedObjectModel,
  Model,
} from '@process-engine/process_model.contracts';

import {parseCollaboration, parseProcesses} from './index';

export function parseDefinitions(parsedObjectModel: IParsedObjectModel): Model.Definitions {

  const definitions = parsedObjectModel[BpmnTags.CommonElement.Definitions];

  return convertToInternalObjectModel(definitions);
}

function convertToInternalObjectModel(parsedXml: any): Model.Definitions {

  const definitions = createDefinitionBaseObject(parsedXml);

  definitions.collaboration = parseCollaboration(parsedXml);
  definitions.processes = parseProcesses(parsedXml);

  return definitions;
}

function createDefinitionBaseObject(parsedXml: any): Model.Definitions {

  const basicDefinition = new Model.Definitions();

  basicDefinition.id = parsedXml.id;
  basicDefinition.xmlns = {
    bpmn: parsedXml[BpmnTags.XmlnsProperty.bpmn],
    bpmndi: parsedXml[BpmnTags.XmlnsProperty.bpmndi],
    camunda: parsedXml[BpmnTags.XmlnsProperty.camunda],
    dc: parsedXml[BpmnTags.XmlnsProperty.dc],
    di: parsedXml[BpmnTags.XmlnsProperty.di],
    xsi: parsedXml[BpmnTags.XmlnsProperty.xsi],
  };

  basicDefinition.targetNamespace = parsedXml.targetNamespace;
  basicDefinition.exporter = parsedXml.exporter;
  basicDefinition.exporterVersion = parsedXml.exporterVersion;

  return basicDefinition;
}
