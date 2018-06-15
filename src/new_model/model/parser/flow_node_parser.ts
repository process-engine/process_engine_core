import {Model} from '@process-engine/process_engine_contracts';
import * as Parser from './index';

// TODO: The following elements are not supported yet:
// - Text annotations
// - Associations
export function parseProcessFlowNodes(processData: any, errors: Array<Model.Types.Error>): Array<Model.Base.FlowNode> {

  let nodes: Array<Model.Base.FlowNode> = [];

  const events: Array<Model.Events.Event> = Parser.parseEventsFromProcessData(processData, errors);
  const gateways: Array<Model.Gateways.Gateway> = Parser.parseGatewaysFromProcessData(processData);
  const tasks: Array<Model.Activities.Activity> = Parser.parseActivitiesFromProcessData(processData);

  nodes = nodes.concat(gateways, tasks, events);

  return nodes;
}
