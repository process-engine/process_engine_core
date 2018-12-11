import * as Bluebird from 'bluebird';

Bluebird.config({
  cancellation: true,
});

// This only needs to be imported once. After that, all is done.
import * as BluebirdGlobal from 'bluebird-global';

export * from './iam_service_mock';
export * from './model';
export * from './runtime';
