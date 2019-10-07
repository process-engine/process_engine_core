import * as should from 'should';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';
import {Model} from '@process-engine/persistence_api.contracts';

import {parseProcesses} from '../../../src/model/parser/process_parser';

import * as SampleData from './sample_data';

describe('ProcessParser.parseProcesses', (): void => {

  it('Should create a parsed process from the given dataset', (): void => {

    const result = parseProcesses(SampleData.DefinitionWithSingleProcess);

    should(result).be.an.Array();
    should(result).be.length(1);

    const process = result[0];

    should(process).be.an.instanceOf(Model.Process);
    should(process.id).be.equal('empty_lane_test');
    should(process.name).be.equal('empty_lane_test');
    should(process.isExecutable).be.true();

    should(process).have.property('laneSet');
    should(process.laneSet.lanes).have.length(1);

    should(process.sequenceFlows).be.an.Array();
    should(process.sequenceFlows).have.length(1);

    should(process.flowNodes).be.an.Array();
    should(process.flowNodes).have.length(2);
  });

  it('Should create two parsed processes from the given dataset', (): void => {

    const result = parseProcesses(SampleData.DefinitionWithTwoProcesses);

    should(result).be.an.Array();
    should(result).be.length(2);

    for (const process of result) {
      should(process).be.an.instanceOf(Model.Process);
    }
  });

  it('Should create a parsed definition without any processes', (): void => {

    const result = parseProcesses({});

    should(result).be.an.Array();
    should(result).be.length(0);
  });

  it('Should throw an error, if the provided definition is missing an ID', (): void => {
    try {
      const result = parseProcesses(SampleData.DefinitionWithouProcesstId);
      should.fail(result, undefined, 'This should have failed, because the given process is missing an ID!');
    } catch (error) {
      should(error).be.instanceOf(UnprocessableEntityError);
      should(error.message).be.match(/the given element has no id/i);
    }
  });
});
