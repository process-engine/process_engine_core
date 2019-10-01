import * as should from 'should';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';
import {Model} from '@process-engine/persistence_api.contracts';

import {parseProcessSequenceFlows} from '../../../src/model/parser/sequence_flow_parser';

import * as SampleData from './sample_data';

describe('DefinitionParser.parseDefinition', (): void => {

  it('Should parse a list of SequenceFlows', (): void => {

    const result = parseProcessSequenceFlows(SampleData.ProcessWithMultipleSequenceFlows);

    should(result).be.an.Array();
    should(result).have.length(3);

    for (const entry of result) {
      should(entry).be.an.instanceOf(Model.ProcessElements.SequenceFlow);
      should(entry).have.property('id');
      should(entry).have.property('sourceRef');
      should(entry).have.property('targetRef');
    }
  });

  it('Should parse a single SequenceFlow', (): void => {

    const result = parseProcessSequenceFlows(SampleData.ProcessWithSingleSequenceFlow);

    should(result).be.an.Array();
    should(result).have.length(1);

    should(result[0]).be.an.instanceOf(Model.ProcessElements.SequenceFlow);
    should(result[0].id).be.equal('SequenceFlow_1');
    should(result[0].sourceRef).be.equal('StartEvent_1');
    should(result[0].targetRef).be.equal('EndEvent_1');
  });

  it('Should parse a SequenceFlows with conditional expressions', (): void => {

    const result = parseProcessSequenceFlows(SampleData.ProcessWithConditionalSequenceFlows);

    should(result).be.an.Array();
    should(result).have.length(3);

    const sequenceFlowWithCondition = result.find((flow): boolean => flow.id === 'SequenceFlow_Conditional');

    const expectedConditionType = 'bpmn:tFormalExpression';
    const expectedCondition = 'token.current.someCondition === \'true\'';

    should(sequenceFlowWithCondition).have.property('conditionExpression');
    should(sequenceFlowWithCondition.conditionExpression.type).be.equal(expectedConditionType);
    should(sequenceFlowWithCondition.conditionExpression.expression).be.equal(expectedCondition);
  });

  it('Should return an empty list, if no SequenceFlows exist', (): void => {

    const result = parseProcessSequenceFlows({});

    should(result).be.an.Array();
    should(result).have.length(0);
  });

  it('Should throw an error, if any of the SequenceFlows are missing an ID', (): void => {
    try {
      const result = parseProcessSequenceFlows(SampleData.ProcessWithSequenceFlowsWithoutIds);
      should.fail(result, undefined, 'This should have failed, because one of the sublanes is missing an ID!');
    } catch (error) {
      should(error).be.instanceOf(UnprocessableEntityError);
      should(error.message).be.match(/the given element has no id/i);
    }
  });
});
