import * as should from 'should';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';
import {Model} from '@process-engine/persistence_api.contracts';

import {parseDefinitions} from '../../../src/model/parser/definitions_parser';

import * as SampleData from './sample_data';

describe('DefinitionParser.parseDefinition', (): void => {

  const defaultXmlnsHeaders = {
    bpmn: 'http://www.omg.org/spec/BPMN/20100524/MODEL',
    bpmndi: 'http://www.omg.org/spec/BPMN/20100524/DI',
    camunda: undefined,
    dc: 'http://www.omg.org/spec/DD/20100524/DC',
    di: 'http://www.omg.org/spec/DD/20100524/DI',
    xsi: 'http://www.w3.org/2001/XMLSchema-instance',
  };
  const defaultTargetNamespace = 'http://bpmn.io/schema/bpmn';
  const defaultExporter = 'BPMN Studio';
  const defaultExporterVersion = '1';

  it('Should create a parsed definition with one process', (): void => {

    const result = parseDefinitions(SampleData.DefinitionWithSingleProcess);

    assertDefinition(result);

    should(result.collaboration.participants).be.an.Array();
    should(result.collaboration.participants).be.length(1);

    should(result.processes).be.an.Array();
    should(result.processes).be.length(1);
  });

  it('Should create a parsed definition with two processes', (): void => {

    const result = parseDefinitions(SampleData.DefinitionWithTwoProcesses);

    assertDefinition(result);

    should(result.collaboration.participants).be.an.Array();
    should(result.collaboration.participants).be.length(2);

    should(result.processes).be.an.Array();
    should(result.processes).be.length(2);
  });

  it('Should create a parsed definition without any processes', (): void => {

    const result = parseDefinitions(SampleData.DefinitionWithoutProcess);

    assertDefinition(result);

    should(result.collaboration.participants).be.an.Array();
    should(result.collaboration.participants).be.length(1);

    should(result.processes).be.an.Array();
    should(result.processes).be.length(0);
  });

  it('Should create a parsed definition without any header information', (): void => {

    const result = parseDefinitions(SampleData.DefinitionWithoutHeaderInformation);

    const expectedXmlnsHeaders = {
      bpmn: undefined,
      bpmndi: undefined,
      camunda: undefined,
      dc: undefined,
      di: undefined,
      xsi: undefined,
    };

    should(result).be.an.instanceOf(Model.Definitions);
    should(result.xmlns).be.eql(expectedXmlnsHeaders);
    should.not.exist(result.targetNamespace);
    should.not.exist(result.exporter);
    should.not.exist(result.exporterVersion);

    should(result.collaboration.participants).be.an.Array();
    should(result.collaboration.participants).be.length(1);

    should(result.processes).be.an.Array();
    should(result.processes).be.length(1);
  });

  it('Should throw an error, if the provided definition is missing an ID', (): void => {
    try {
      const result = parseDefinitions(SampleData.DefinitionWithoutId);
      should.fail(result, undefined, 'This should have failed, because the given definition is missing an ID!');
    } catch (error) {
      should(error).be.instanceOf(UnprocessableEntityError);
      should(error.message).be.match(/the given element has no id/i);
    }
  });

  function assertDefinition(definition: Model.Definitions): void {
    should(definition).be.an.instanceOf(Model.Definitions);
    should(definition.xmlns).be.eql(defaultXmlnsHeaders);
    should(definition.targetNamespace).be.equal(defaultTargetNamespace);
    should(definition.exporter).be.equal(defaultExporter);
    should(definition.exporterVersion).be.equal(defaultExporterVersion);
  }
});
