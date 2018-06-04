import {
  BpmnTags,
  Definitions,
  IModelParser,
  IParsedObjectModel,
  Model,
} from '@process-engine/process_engine_contracts';

import * as Parser from './index';

export function parseDefinitions(parsedObjectModel: IParsedObjectModel): Definitions {

  const definitions: any = parsedObjectModel[BpmnTags.CommonElement.Definitions];

  return convertToInternalObjectModel(definitions);
}

function convertToInternalObjectModel(parsedXml: any): Definitions {

  const definitions: Definitions = createDefinitionBaseObject(parsedXml);

  definitions.collaboration = Parser.parseCollaboration(parsedXml);
  definitions.processes = Parser.parseProcesses(parsedXml);

  return definitions;
}

function createDefinitionBaseObject(parsedXml: any): Definitions {

  const basicDefinition: Definitions = new Definitions();

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
