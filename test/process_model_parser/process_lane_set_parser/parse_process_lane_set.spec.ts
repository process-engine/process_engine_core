import * as should from 'should';

import {UnprocessableEntityError} from '@essential-projects/errors_ts';

import {Model} from '@process-engine/persistence_api.contracts';

import {parseProcessLaneSet} from '../../../src/model/parser/process_lane_set_parser';

import * as SampleData from './sample_data';

describe('LaneSetParser.parseProcessLaneSet', (): void => {

  it('Should parse a LaneSet that contains a single lane', (): void => {

    const result = parseProcessLaneSet(SampleData.ProcessWithSingleLane);

    should(result).be.instanceOf(Model.ProcessElements.LaneSet);
    should(result.lanes).be.an.Array();
    should(result.lanes).have.length(1);

    const lane = result.lanes[0];

    should(lane.id).be.equal('Lane_1');
    should(lane.name).be.equal('Boss');
    should(lane.flowNodeReferences).have.length(12);
  });

  it('Should parse a LaneSet that contains multiple lanes', (): void => {

    const result = parseProcessLaneSet(SampleData.ProcessWithMultipleLanes);

    should(result).be.instanceOf(Model.ProcessElements.LaneSet);
    should(result.lanes).be.an.Array();
    should(result.lanes).have.length(2);

    const lane1WasParsed = result.lanes.some((lane): boolean => lane.id === 'Lane_1' && lane.name === 'Developer');
    const lane2WasParsed = result.lanes.some((lane): boolean => lane.id === 'Lane_2' && lane.name === 'CI Dude');

    should(lane1WasParsed).be.true();
    should(lane2WasParsed).be.true();
  });

  it('Should parse a LaneSet that contains lanes and sublanes', (): void => {

    const result = parseProcessLaneSet(SampleData.ProcessWithSubLanes);

    should(result).be.instanceOf(Model.ProcessElements.LaneSet);
    should(result.lanes).be.an.Array();
    should(result.lanes).have.length(1);

    const lane = result.lanes[0];

    should(lane.id).be.equal('Lane_1');
    should(lane.name).be.equal('LaneA');
    should(lane.flowNodeReferences).have.length(6);

    should(lane).have.property('childLaneSet');

    const subLaneSet = lane.childLaneSet;

    should(subLaneSet.lanes).be.an.Array();
    should(subLaneSet.lanes).have.length(2);

    const subLane1WasParsed = subLaneSet.lanes.some((sublane): boolean => sublane.id === 'SubLane_1' && sublane.name === 'LaneB');
    const subLane2WasParsed = subLaneSet.lanes.some((sublane): boolean => sublane.id === 'SubLane_2' && sublane.name === 'LaneC');

    should(subLane1WasParsed).be.true();
    should(subLane2WasParsed).be.true();
  });

  it('Should parse empty LaneSets', (): void => {

    const result = parseProcessLaneSet(SampleData.ProcessWithEmptyLaneSet);

    should(result).be.instanceOf(Model.ProcessElements.LaneSet);
    should(result.lanes).be.an.Array();
    should(result.lanes).have.length(0);
  });

  it('Should parse empty SubLaneSets', (): void => {

    const result = parseProcessLaneSet(SampleData.ProcessWithEmptySubLaneSet);

    should(result).be.instanceOf(Model.ProcessElements.LaneSet);
    should(result.lanes).be.an.Array();
    should(result.lanes).have.length(1);

    const lane = result.lanes[0];

    should(lane).have.property('childLaneSet');

    should(lane.childLaneSet.lanes).be.an.Array();
    should(lane.childLaneSet.lanes).have.length(0);

  });

  it('Should return nothing, if the given data does not contain any LaneSets', (): void => {

    const result = parseProcessLaneSet({});
    should.not.exist(result);
  });

  it('Should throw an error, if any lane is missing an ID.', (): void => {
    try {
      const result = parseProcessLaneSet(SampleData.ProcessWithLaneWithoutId);
      should.fail(result, undefined, 'This should have failed, because one of the lanes is missing an ID!');
    } catch (error) {
      should(error).be.instanceOf(UnprocessableEntityError);
      should(error.message).be.match(/the given element has no id/i);
    }
  });

  it('Should throw an error, if any sublane is missing an ID.', (): void => {
    try {
      const result = parseProcessLaneSet(SampleData.ProcessWithSubLaneWithoutId);
      should.fail(result, undefined, 'This should have failed, because one of the sublanes is missing an ID!');
    } catch (error) {
      should(error).be.instanceOf(UnprocessableEntityError);
      should(error.message).be.match(/the given element has no id/i);
    }
  });

});
