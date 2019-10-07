import {Model} from '@process-engine/persistence_api.contracts';

import {ActivityParsers} from './activity_parsers/index';

export function parseActivitiesFromProcessData(
  processData: any,
  errors: Array<Model.GlobalElements.Error>,
  eventDefinitions: Array<Model.Events.Definitions.EventDefinition>,
): Array<Model.Activities.Activity> {

  const emptyActivities = ActivityParsers.EmptyActivityParser.parseEmptyActivities(processData);
  const manualTasks = ActivityParsers.ManualTaskParser.parseManualTasks(processData);
  const userTasks = ActivityParsers.UserTaskParser.parseUserTasks(processData);
  const scriptTasks = ActivityParsers.ScriptTaskParser.parseScriptTasks(processData);
  const serviceTasks = ActivityParsers.ServiceTaskParser.parseServiceTasks(processData);
  const callActivities = ActivityParsers.CallActivityParser.parseCallActivities(processData);
  const subProcesses = ActivityParsers.SubProcessParser.parseSubProcesses(processData, errors, eventDefinitions);
  const sendTasks = ActivityParsers.SendTaskParser.parseSendTasks(processData, eventDefinitions);
  const receiveTasks = ActivityParsers.ReceiveTaskParser.parseReceiveTasks(processData, eventDefinitions);

  return Array
    .prototype
    .concat(emptyActivities, manualTasks, userTasks, scriptTasks, serviceTasks, callActivities, subProcesses, sendTasks, receiveTasks);
}
