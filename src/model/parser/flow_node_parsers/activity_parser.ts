import {Model} from '@process-engine/process_model.contracts';

import {ActivityParsers} from './activity_parsers/index';

export function parseActivitiesFromProcessData(
  processData: any,
  errors: Array<Model.GlobalElements.Error>,
  eventDefinitions: Array<Model.Events.Definitions.EventDefinition>,
): Array<Model.Activities.Activity> {

  const emptyActivities: Array<Model.Activities.ManualTask> = ActivityParsers.EmptyActivityParser.parseEmptyActivities(processData);
  const manualTasks: Array<Model.Activities.ManualTask> = ActivityParsers.ManualTaskParser.parseManualTasks(processData);
  const userTasks: Array<Model.Activities.UserTask> = ActivityParsers.UserTaskParser.parseUserTasks(processData);
  const scriptTasks: Array<Model.Activities.ScriptTask> = ActivityParsers.ScriptTaskParser.parseScriptTasks(processData);
  const serviceTasks: Array<Model.Activities.ServiceTask> = ActivityParsers.ServiceTaskParser.parseServiceTasks(processData);
  const callActivities: Array<Model.Activities.CallActivity> = ActivityParsers.CallActivityParser.parseCallActivities(processData);
  const subProcesses: Array<Model.Activities.SubProcess> = ActivityParsers.SubProcessParser.parseSubProcesses(processData, errors, eventDefinitions);
  const sendTasks: Array<Model.Activities.SendTask> = ActivityParsers.SendTaskParser.parseSendTasks(processData, eventDefinitions);
  const receiveTasks: Array<Model.Activities.ReceiveTask> = ActivityParsers.ReceiveTaskParser.parseReceiveTasks(processData, eventDefinitions);

  return Array
    .prototype
    .concat(emptyActivities, manualTasks, userTasks, scriptTasks, serviceTasks, callActivities, subProcesses, sendTasks, receiveTasks);
}
