import * as Bluebird from 'bluebird';

// By default, Promise-Cancellation is deactivated.
// We need to activate it here in order to be able to use it.
Bluebird.config({
  cancellation: true,
});

// This allows us to use Bluebird Promises as return values for async functions.
// These usually only take "Promise<T>".
// Only needs to be imported once. After that, using Bluebird types is safe.
import * as BluebirdGlobal from 'bluebird-global';

export * from './iam_service_mock';
export * from './model';
export * from './runtime';
