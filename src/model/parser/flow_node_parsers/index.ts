import * as activityParser from './activity_parser';
import * as eventParser from './event_parser';
import * as gatewayParser from './gateway_parser';

// tslint:disable-next-line:no-namespace
export namespace FlowNodeParsers {
  export import ActivityParser = activityParser;
  export import EventParser = eventParser;
  export import GatewayParser = gatewayParser;
}
