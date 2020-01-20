import * as should from 'should';

import {Model} from '@process-engine/persistence_api.contracts';

import {NotFoundError} from '@essential-projects/errors_ts';

import {ErrorBoundaryEventHandler} from '../../../src/runtime/flow_node_handler/boundary_event_handler/error_boundary_event_handler';
import {TestFixtureProvider} from '../../test_fixture_provider';
import {EventAggregatorMock, FlowNodePersistenceFacadeMock} from '../../mocks';

describe('ErrorBoundaryEventHandler.canHandleError ', (): void => {

  let fixtureProvider: TestFixtureProvider;

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();
  });

  it('Should return true, if the given error matches in name, code and message.', async (): Promise<void> => {

    const errorEventDefinition = new Model.Events.Definitions.ErrorEventDefinition();
    errorEventDefinition.name = 'NotFoundError';
    errorEventDefinition.code = '404';
    errorEventDefinition.message = 'I failed to find something you wanted. Sorry.';

    const boundaryEvent = createErrorBoundaryEvent(errorEventDefinition);
    const handler = createHandler(boundaryEvent);

    const sampleError = new NotFoundError('I failed to find something you wanted. Sorry.');

    const canHandleError = handler.canHandleError(sampleError, {} as any);

    should(canHandleError).be.true();
  });

  it('Should return true, if the configured error has a matching name and no other configurations.', async (): Promise<void> => {

    const errorEventDefinition = new Model.Events.Definitions.ErrorEventDefinition();
    errorEventDefinition.name = 'NotFoundError';

    const boundaryEvent = createErrorBoundaryEvent(errorEventDefinition);
    const handler = createHandler(boundaryEvent);

    const sampleError = new NotFoundError('I failed to find something you wanted. Sorry.');

    const canHandleError = handler.canHandleError(sampleError, {} as any);

    should(canHandleError).be.true();
  });

  it('Should return true, if the configured error has a matching code and no other configurations.', async (): Promise<void> => {

    const errorEventDefinition = new Model.Events.Definitions.ErrorEventDefinition();
    errorEventDefinition.code = '404';

    const boundaryEvent = createErrorBoundaryEvent(errorEventDefinition);
    const handler = createHandler(boundaryEvent);

    const sampleError = new NotFoundError('I failed to find something you wanted. Sorry.');

    const canHandleError = handler.canHandleError(sampleError, {} as any);

    should(canHandleError).be.true();

  });

  it('Should return true, if the configured error has a matching message and no other configurations.', async (): Promise<void> => {

    const errorEventDefinition = new Model.Events.Definitions.ErrorEventDefinition();
    errorEventDefinition.message = 'I failed to find something you wanted. Sorry.';

    const boundaryEvent = createErrorBoundaryEvent(errorEventDefinition);
    const handler = createHandler(boundaryEvent);

    const sampleError = new NotFoundError('I failed to find something you wanted. Sorry.');

    const canHandleError = handler.canHandleError(sampleError, {} as any);

    should(canHandleError).be.true();

  });

  it('Should return true, if the configured error has only empty values', async (): Promise<void> => {

    const errorEventDefinition = new Model.Events.Definitions.ErrorEventDefinition();

    const boundaryEvent = createErrorBoundaryEvent(errorEventDefinition);
    const handler = createHandler(boundaryEvent);

    const sampleError = new NotFoundError('I failed to find something you wanted. Sorry.');

    const canHandleError = handler.canHandleError(sampleError, {} as any);

    should(canHandleError).be.true();

  });

  it('Should return true, if the configured error does not exist', async (): Promise<void> => {

    const boundaryEvent = createErrorBoundaryEvent(undefined);
    const handler = createHandler(boundaryEvent);

    const sampleError = new NotFoundError('I failed to find something you wanted. Sorry.');

    const canHandleError = handler.canHandleError(sampleError, {} as any);

    should(canHandleError).be.true();

  });

  it('Should return true, if the name does not match and nothing else is configured.', async (): Promise<void> => {

    const errorEventDefinition = new Model.Events.Definitions.ErrorEventDefinition();
    errorEventDefinition.name = 'I failed to find something you wanted. Sorry.';

    const boundaryEvent = createErrorBoundaryEvent(errorEventDefinition);
    const handler = createHandler(boundaryEvent);

    const sampleError = new NotFoundError('I failed to find something you wanted. Sorry.');

    const canHandleError = handler.canHandleError(sampleError, {} as any);

    should(canHandleError).be.true();

  });

  it('Should return true, if the code matches, but the name does not.', async (): Promise<void> => {

    const errorEventDefinition = new Model.Events.Definitions.ErrorEventDefinition();
    errorEventDefinition.name = 'I failed to find something you wanted. Sorry.';
    errorEventDefinition.code = '404';

    const boundaryEvent = createErrorBoundaryEvent(errorEventDefinition);
    const handler = createHandler(boundaryEvent);

    const sampleError = new NotFoundError('I failed to find something you wanted. Sorry.');

    const canHandleError = handler.canHandleError(sampleError, {} as any);

    should(canHandleError).be.true();

  });

  it('Should return false, if name matches, but another property does not', async (): Promise<void> => {

    const errorEventDefinition = new Model.Events.Definitions.ErrorEventDefinition();
    errorEventDefinition.name = 'NotFoundError';
    errorEventDefinition.code = '666';

    const boundaryEvent = createErrorBoundaryEvent(errorEventDefinition);
    const handler = createHandler(boundaryEvent);

    const sampleError = new NotFoundError('I failed to find something you wanted. Sorry.');

    const canHandleError = handler.canHandleError(sampleError, {} as any);

    should(canHandleError).be.false();

  });

  it('Should return false, if code matches, but another property does not', async (): Promise<void> => {

    const errorEventDefinition = new Model.Events.Definitions.ErrorEventDefinition();
    errorEventDefinition.message = 'WrongErrorType';
    errorEventDefinition.code = '404';

    const boundaryEvent = createErrorBoundaryEvent(errorEventDefinition);
    const handler = createHandler(boundaryEvent);

    const sampleError = new NotFoundError('I failed to find something you wanted. Sorry.');

    const canHandleError = handler.canHandleError(sampleError, {} as any);

    should(canHandleError).be.false();

  });

  it('Should return false, if message matches, but another property does not', async (): Promise<void> => {

    const errorEventDefinition = new Model.Events.Definitions.ErrorEventDefinition();
    errorEventDefinition.code = '666';
    errorEventDefinition.message = 'I failed to find something you wanted. Sorry.';

    const boundaryEvent = createErrorBoundaryEvent(errorEventDefinition);
    const handler = createHandler(boundaryEvent);

    const sampleError = new NotFoundError('I failed to find something you wanted. Sorry.');

    const canHandleError = handler.canHandleError(sampleError, {} as any);

    should(canHandleError).be.false();

  });

  it('Should return false, if no property matches', async (): Promise<void> => {

    const errorEventDefinition = new Model.Events.Definitions.ErrorEventDefinition();
    errorEventDefinition.name = 'WrongErrorType';
    errorEventDefinition.code = '666';
    errorEventDefinition.message = 'I don\'t want this test to succeed.';

    const boundaryEvent = createErrorBoundaryEvent(errorEventDefinition);
    const handler = createHandler(boundaryEvent);

    const sampleError = new NotFoundError('I failed to find something you wanted. Sorry.');

    const canHandleError = handler.canHandleError(sampleError, {} as any);

    should(canHandleError).be.false();

  });

  function createErrorBoundaryEvent(errorEventDefinition: Model.Events.Definitions.ErrorEventDefinition): Model.Events.BoundaryEvent {

    const boundaryEvent = new Model.Events.BoundaryEvent();
    boundaryEvent.id = 'TestBoundaryEvent';
    boundaryEvent.cancelActivity = true;
    boundaryEvent.errorEventDefinition = errorEventDefinition;

    return boundaryEvent;
  }

  function createHandler(boundaryEventModel: Model.Events.BoundaryEvent): ErrorBoundaryEventHandler {
    const eventAggregatorMock = new EventAggregatorMock();
    const flowNodePersistenceFacadeMock = new FlowNodePersistenceFacadeMock();

    return new ErrorBoundaryEventHandler(eventAggregatorMock, flowNodePersistenceFacadeMock, boundaryEventModel);
  }
});
