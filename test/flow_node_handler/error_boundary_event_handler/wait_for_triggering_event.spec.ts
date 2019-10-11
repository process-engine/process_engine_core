import * as should from 'should';

import {Model} from '@process-engine/persistence_api.contracts';

import {ErrorBoundaryEventHandler} from '../../../src/runtime/flow_node_handler/boundary_event_handler/error_boundary_event_handler';
import {TestFixtureProvider} from '../../test_fixture_provider';
import {EventAggregatorMock, FlowNodePersistenceFacadeMock, ProcessModelFacadeMock} from '../../mocks';

describe('ErrorBoundaryEventHandler.waitForTriggeringEvent ', (): void => {

  let fixtureProvider: TestFixtureProvider;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('Should successfully persist the onEnter state after called.', async (): Promise<void> => {

    const boundaryEvent = createErrorBoundaryEvent();

    const eventAggregatorMock = new EventAggregatorMock();
    const flowNodePersistenceFacadeMock = new FlowNodePersistenceFacadeMock();
    const processModelFacadeMock = new ProcessModelFacadeMock();

    let persistOnEnterWasCalled = false;

    flowNodePersistenceFacadeMock.persistOnEnter = async (): Promise<void> => {
      persistOnEnterWasCalled = true;
      return Promise.resolve();
    };

    const handler = new ErrorBoundaryEventHandler(eventAggregatorMock, flowNodePersistenceFacadeMock, boundaryEvent);

    await handler.waitForTriggeringEvent((): any => {}, {} as any, {} as any, processModelFacadeMock, 'flowNodeInstanceId');

    should(persistOnEnterWasCalled).be.true();
  });

  function createErrorBoundaryEvent(): Model.Events.BoundaryEvent {
    const boundaryEvent = new Model.Events.BoundaryEvent();
    boundaryEvent.id = 'TestBoundaryEvent';
    boundaryEvent.errorEventDefinition = new Model.Events.Definitions.ErrorEventDefinition();

    return boundaryEvent;
  }
});
