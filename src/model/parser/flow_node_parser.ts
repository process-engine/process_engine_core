import {Model} from '@process-engine/process_model.contracts';
import * as Parser from './index';

// TODO: The following elements are not supported yet:
// - Text annotations
// - Associations
export function parseProcessFlowNodes(
  processData: any,
  errors: Array<Model.GlobalElements.Error>,
  eventDefinitions: Array<Model.Events.Definitions.EventDefinition>,
): Array<Model.Base.FlowNode> {

  let nodes: Array<Model.Base.FlowNode> = [];

  const events: Array<Model.Events.Event> = Parser.parseEventsFromProcessData(processData, errors, eventDefinitions);
  const gateways: Array<Model.Gateways.Gateway> = Parser.parseGatewaysFromProcessData(processData);
  const tasks: Array<Model.Activities.Activity> = Parser.parseActivitiesFromProcessData(processData, errors, eventDefinitions);

  nodes = nodes.concat(gateways, tasks, events);

  return nodes;
}
