/* eslint-disable @typescript-eslint/no-unused-vars */
import * as callActivityParser from './call_activity_parser';
import * as emptyActivityParser from './empty_activity_parser';
import * as manualTaskParser from './manual_task_parser';
import * as receiveTaskParser from './receive_task_parser';
import * as scriptTaskParser from './script_task_parser';
import * as sendTaskParser from './send_task_parser';
import * as serviceTaskParser from './service_task_parser';
import * as subProcessParser from './subprocess_parser';
import * as userTaskParser from './user_task_parser';

export namespace ActivityParsers {
  export import CallActivityParser = callActivityParser;
  export import EmptyActivityParser = emptyActivityParser;
  export import ManualTaskParser = manualTaskParser;
  export import ReceiveTaskParser = receiveTaskParser;
  export import ScriptTaskParser = scriptTaskParser;
  export import SendTaskParser = sendTaskParser;
  export import ServiceTaskParser = serviceTaskParser;
  export import SubProcessParser = subProcessParser;
  export import UserTaskParser = userTaskParser;
}
