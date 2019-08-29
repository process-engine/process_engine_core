/* eslint-disable dot-notation */
import * as should from 'should';

import {ProcessModelFacadeFactory} from '../../src/runtime/facades/process_model_facade_factory';
import {ProcessModelFacade} from '../../src/runtime/facades/process_model_facade';
import {TestFixtureProvider} from '../test_fixture_provider';

describe('ProcessModelFacadeFactory.create', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let processModelFacadeFactory: ProcessModelFacadeFactory;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    processModelFacadeFactory = new ProcessModelFacadeFactory();
  });

  it('Should create a new instance of a ProcessModelFacade, using the provided ProcessModel as a baseline', (): void => {

    const sampleProcessModel = {
      id: 'ProcessModelId',
      name: 'SampleProcessModel',
      isExecutable: true,
      flowNodes: [],
      sequenceFlows: [],
    };

    const processModelFacade = processModelFacadeFactory.create(sampleProcessModel);

    should(processModelFacade).be.instanceOf(ProcessModelFacade);
    should(processModelFacade['processModel']).be.eql(sampleProcessModel);
  });

  it('Should throw an error, if no ProcessModel is provided', (): void => {
    try {
      const processModelFacade = processModelFacadeFactory.create(undefined);
      should.fail(processModelFacade, undefined, 'This should not have succeeded, because no ProcessModel was provided!');
    } catch (error) {
      should(error.message).be.match(/must provide a processmodel/i);
    }
  });
});
