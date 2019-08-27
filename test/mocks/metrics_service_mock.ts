import * as moment from 'moment';
import {IIdentity} from '@essential-projects/iam_contracts';
import {Metric} from '@process-engine/metrics_api_contracts';

export class MetricsServiceMock {

  public readMetricsForProcessModel(identity: IIdentity, processModelId: string): Promise<Array<Metric>> {
    return Promise.resolve([]);
  }

  public writeOnProcessStarted(correlationId: string, processInstanceId: string, processModelId: string, timestamp: moment.Moment): Promise<void> {
    return Promise.resolve();
  }

  public writeOnProcessFinished(correlationId: string, processInstanceId: string, processModelId: string, timestamp: moment.Moment): Promise<void> {
    return Promise.resolve();
  }

  public writeOnProcessError(
    correlationId: string,
    processInstanceId: string,
    processModelId: string,
    error: Error,
    timestamp: moment.Moment,
  ): Promise<void> {
    return Promise.resolve();
  }

  public writeOnFlowNodeInstanceEnter(
    correlationId: string,
    processInstanceId: string,
    processModelId: string,
    flowNodeInstanceId: string,
    flowNodeId: string,
    tokenPayload: any,
    timestamp: moment.Moment,
  ): Promise<void> {
    return Promise.resolve();
  }

  public writeOnFlowNodeInstanceExit(
    correlationId: string,
    processInstanceId: string,
    processModelId: string,
    flowNodeInstanceId: string,
    flowNodeId: string,
    tokenPayload: any,
    timestamp: moment.Moment,
  ): Promise<void> {
    return Promise.resolve();
  }

  public writeOnFlowNodeInstanceError(
    correlationId: string,
    processInstanceId: string,
    processModelId: string,
    flowNodeInstanceId: string,
    flowNodeId: string,
    tokenPayload: any,
    error: Error,
    timestamp: moment.Moment,
  ): Promise<void> {
    return Promise.resolve();
  }

  public writeOnFlowNodeInstanceSuspend(
    correlationId: string,
    processInstanceId: string,
    processModelId: string,
    flowNodeInstanceId: string,
    flowNodeId: string,
    tokenPayload: any,
    timestamp: moment.Moment,
  ): Promise<void> {
    return Promise.resolve();
  }

  public writeOnFlowNodeInstanceResume(
    correlationId: string,
    processInstanceId: string,
    processModelId: string,
    flowNodeInstanceId: string,
    flowNodeId: string,
    tokenPayload: any,
    timestamp: moment.Moment,
  ): Promise<void> {
    return Promise.resolve();
  }

}
