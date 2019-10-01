import * as should from 'should';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';

import {BpmnType} from '@process-engine/persistence_api.contracts';

import {parseProcessFlowNodes} from '../../../src/model/parser/flow_node_parser';

import * as SampleData from './sample_data';

describe('FlowNodeParser.parseProcessFlowNodes', (): void => {

  it('Should parse all FlowNodes of varying type from the given process model', (): void => {

    const result = parseProcessFlowNodes(SampleData.ProcessWithMixedFlowNodes, [], []);

    should(result).be.an.Array();
    should(result).be.length(12);

    const numberOfExclusiveGateways = result.filter((value): boolean => value.bpmnType === BpmnType.exclusiveGateway).length;
    const numberOfParallelGateways = result.filter((value): boolean => value.bpmnType === BpmnType.parallelGateway).length;
    const numberOfUserTasks = result.filter((value): boolean => value.bpmnType === BpmnType.userTask).length;
    const numberOfCallActivities = result.filter((value): boolean => value.bpmnType === BpmnType.callActivity).length;
    const numberOfStartEvents = result.filter((value): boolean => value.bpmnType === BpmnType.startEvent).length;
    const numberOfEndEvents = result.filter((value): boolean => value.bpmnType === BpmnType.endEvent).length;

    should(numberOfExclusiveGateways).be.equal(2);
    should(numberOfParallelGateways).be.equal(2);
    should(numberOfUserTasks).be.equal(1);
    should(numberOfCallActivities).be.equal(3);
    should(numberOfStartEvents).be.equal(2);
    should(numberOfEndEvents).be.equal(2);
  });

  it('Should throw an error, if any of the given FlowNodes are missing an ID.', (): void => {
    try {
      const result = parseProcessFlowNodes(SampleData.ProcessWithMissingIds, [], []);
      should.fail(result, undefined, 'This should have failed, because some of the FlowNodes are missing an ID!');
    } catch (error) {
      should(error).be.instanceOf(UnprocessableEntityError);
      should(error.message).be.match(/the given element has no id/i);
    }
  });

});
