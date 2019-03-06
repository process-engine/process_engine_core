import {Model} from '@process-engine/process_model.contracts';
import {FlowNodeParsers} from './flow_node_parsers/index';

export function parseProcessFlowNodes(
  processData: any,
  errors: Array<Model.GlobalElements.Error>,
  eventDefinitions: Array<Model.Events.Definitions.EventDefinition>,
): Array<Model.Base.FlowNode> {

  let nodes: Array<Model.Base.FlowNode> = [];

  const events: Array<Model.Events.Event> = FlowNodeParsers.EventParser.parseEventsFromProcessData(processData, errors, eventDefinitions);
  const gateways: Array<Model.Gateways.Gateway> = FlowNodeParsers.GatewayParser.parseGatewaysFromProcessData(processData);
  const activities: Array<Model.Activities.Activity> =
    FlowNodeParsers.ActivityParser.parseActivitiesFromProcessData(processData, errors, eventDefinitions);

  nodes = nodes.concat(gateways, activities, events);

  return nodes;
}
