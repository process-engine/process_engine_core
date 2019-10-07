import * as should from 'should';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';

import {Model} from '@process-engine/persistence_api.contracts';

import {parseCollaboration} from '../../../src/model/parser/collaboration_parser';

describe('CollaborationParser.parseCollaboration', (): void => {

  it('Should create a parsed collaboration with a single participant from the given data', (): void => {

    const sampleData = {
      'bpmn:collaboration': {
        id: 'Collaboration_1cidyxu',
        name: 'SampleCollaboration',
        'bpmn:documentation': 'Hello Hello',
        'bpmn:participant': {
          id: 'Participant_0px403d',
          'bpmn:documentation': 'World World',
          name: 'sampleParticipant',
          processRef: 'sampleParticipant',
        },
      },
    };

    const result = parseCollaboration(sampleData);

    should(result).be.an.instanceOf(Model.Collaboration);
    should(result.id).be.equal(sampleData['bpmn:collaboration'].id);
    should(result.name).be.equal(sampleData['bpmn:collaboration'].name);
    should(result.documentation).be.eql(['Hello Hello']);

    should(result.participants).be.an.Array();
    should(result.participants).have.length(1);

    const participant = result.participants[0];

    should(participant.id).be.equal('Participant_0px403d');
    should(participant.name).be.equal('sampleParticipant');
    should(participant.processReference).be.equal('sampleParticipant');
    should(participant.documentation).be.eql(['World World']);
  });

  it('Should create a parsed collaboration with multiple participants from the given data', (): void => {

    const sampleData = {
      'bpmn:collaboration': {
        id: 'Collaboration_1cidyxu',
        name: 'SampleCollaboration',
        'bpmn:documentation': 'Hello Hello',
        'bpmn:participant': [{
          id: 'Participant_1',
          name: 'sampleParticipant1',
          'bpmn:documentation': 'World World',
          processRef: 'sampleParticipant',
        }, {
          id: 'Participant_2',
          name: 'sampleParticipant2',
          processRef: 'sampleParticipant2',
        }],
      },
    };

    const result = parseCollaboration(sampleData);

    should(result).be.an.instanceOf(Model.Collaboration);
    should(result.id).be.equal(sampleData['bpmn:collaboration'].id);
    should(result.name).be.equal(sampleData['bpmn:collaboration'].name);
    should(result.documentation).be.eql(['Hello Hello']);

    should(result.participants).be.an.Array();
    should(result.participants).have.length(2);
  });

  it('Should throw an error, if the collaboration has no ID.', (): void => {

    const sampleData = {
      'bpmn:collaboration': {
        name: 'SampleCollaboration',
        'bpmn:documentation': 'Hello Hello',
        'bpmn:participant': {
          id: 'Participant_1',
          name: 'sampleParticipant1',
          'bpmn:documentation': 'World World',
          processRef: 'sampleParticipant',
        },
      },
    };

    try {
      const result = parseCollaboration(sampleData);
      should.fail(result, undefined, 'This should have failed, because the Collaboration is missing an ID.');
    } catch (error) {
      should(error).be.instanceOf(UnprocessableEntityError);
      should(error.message).be.match(/element has no id/i);
    }
  });

  it('Should throw an error, if the participant has no ID.', (): void => {

    const sampleData = {
      'bpmn:collaboration': {
        id: 'Collaboration_1cidyxu',
        name: 'SampleCollaboration',
        'bpmn:documentation': 'Hello Hello',
        'bpmn:participant': {
          name: 'sampleParticipant1',
          'bpmn:documentation': 'World World',
          processRef: 'sampleParticipant',
        },
      },
    };

    try {
      const result = parseCollaboration(sampleData);
      should.fail(result, undefined, 'This should have failed, because the Collaboration is missing an ID.');
    } catch (error) {
      should(error).be.instanceOf(UnprocessableEntityError);
      should(error.message).be.match(/element has no id/i);
    }
  });

});
