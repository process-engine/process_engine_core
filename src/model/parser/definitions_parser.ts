import {
  BpmnTags,
  IParsedObjectModel,
  Model,
} from '@process-engine/process_model.contracts';

import {Parsers} from './index';

export function parseDefinitions(parsedObjectModel: IParsedObjectModel): Model.Definitions {

  const definitions: any = parsedObjectModel[BpmnTags.CommonElement.Definitions];

  return convertToInternalObjectModel(definitions);
}

function convertToInternalObjectModel(parsedXml: any): Model.Definitions {

  const definitions: Model.Definitions = createDefinitionBaseObject(parsedXml);

  definitions.collaboration = Parsers.CollaborationParser.parseCollaboration(parsedXml);
  definitions.processes = Parsers.ProcessParser.parseProcesses(parsedXml);

  return definitions;
}

function createDefinitionBaseObject(parsedXml: any): Model.Definitions {

  const basicDefinition: Model.Definitions = new Model.Definitions();

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
