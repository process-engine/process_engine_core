import {IIdentity} from '@essential-projects/iam_contracts';
import {LogEntry, LogLevel} from '@process-engine/logging_api_contracts';

export class LoggingServiceMock {

  public readLogForProcessModel(identity: IIdentity, processModelId: string): Promise<Array<LogEntry>> {
    return Promise.resolve([]);
  }

  public writeLogForProcessModel(
    correlationId: string,
    processModelId: string,
    processInstanceId: string,
    logLevel: LogLevel,
    message: string,
    timestamp?: Date,
  ): Promise<void> {
    return Promise.resolve();
  }

  public writeLogForFlowNode(
    correlationId: string,
    processModelId: string,
    processInstanceId: string,
    flowNodeInstanceId: string,
    flowNodeId: string,
    logLevel: LogLevel,
    message: string,
    timestamp?: Date,
  ): Promise<void> {
    return Promise.resolve();
  }

}
