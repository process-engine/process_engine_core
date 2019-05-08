/* eslint-disable @typescript-eslint/no-unused-vars */
import * as activityParser from './activity_parser';
import * as eventParser from './event_parser';
import * as gatewayParser from './gateway_parser';

export namespace FlowNodeParsers {
  export import ActivityParser = activityParser;
  export import EventParser = eventParser;
  export import GatewayParser = gatewayParser;
}
