import {IContainer} from 'addict-ioc';
import {Logger} from 'loggerhythm';
import * as uuid from 'node-uuid';

import {IIdentity} from '@essential-projects/iam_contracts';

import {
  IFlowNodeHandler,
  IProcessModelFacade,
  IProcessTokenFacade,
  Model,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {ProcessTokenFacade} from '../process_token_facade';
import {FlowNodeHandlerInterruptible} from './index';

export class SubProcessHandler extends FlowNodeHandlerInterruptible<Model.Activities.SubProcess> {

  constructor(container: IContainer, subProcessModel: Model.Activities.SubProcess) {
    super(container, subProcessModel);
    this.logger = Logger.createLogger(`processengine:sub_process_handler:${subProcessModel.id}`);
  }

  private get subProcess(): Model.Activities.SubProcess {
    return super.flowNode;
  }

  // TODO: We can't interrupt a Subprocess yet, so this will remain inactive.
  public interrupt(token: Runtime.Types.ProcessToken, terminate?: boolean): Promise<void> {
    return Promise.resolve();
  }

  protected async executeInternally(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    this.logger.verbose(`Executing SubProcess instance ${this.flowNodeInstanceId}.`);
    await this.persistOnEnter(token);

    return this._executeHandler(token, processTokenFacade, processModelFacade, identity);
  }

  protected async _continueAfterSuspend(
    flowNodeInstance: Runtime.Types.FlowNodeInstance,
    onSuspendToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    const flowNodeInstancesForSubProcess: Array<Runtime.Types.FlowNodeInstance> =
      await this.flowNodeInstanceService.queryByProcessInstance(flowNodeInstance.processInstanceId);

    const subProcessWasNotStarted: boolean = flowNodeInstancesForSubProcess.length === 0;
    const subProcessResult: any = subProcessWasNotStarted
      ? await this._executeSubprocess(onSuspendToken, processTokenFacade, processModelFacade, identity)
      : await this._resumeSubProcess(flowNodeInstancesForSubProcess, onSuspendToken, processTokenFacade, processModelFacade, identity);

    onSuspendToken.payload = subProcessResult;
    await this.persistOnResume(onSuspendToken);

    processTokenFacade.addResultForFlowNode(this.subProcess.id, subProcessResult);
    await this.persistOnExit(onSuspendToken);

    return processModelFacade.getNextFlowNodesFor(this.subProcess);
  }

  protected async _executeHandler(
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<Array<Model.Base.FlowNode>> {

    await this.persistOnSuspend(token);
    const subProcessResult: any = await this._executeSubprocess(token, processTokenFacade, processModelFacade, identity);
    token.payload = subProcessResult;
    await this.persistOnResume(token);

    processTokenFacade.addResultForFlowNode(this.subProcess.id, subProcessResult);
    await this.persistOnExit(token);

    return processModelFacade.getNextFlowNodesFor(this.subProcess);
  }

  private async _executeSubprocess(
    currentProcessToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<any> {

    const subProcessModelFacade: IProcessModelFacade = processModelFacade.getSubProcessModelFacade(this.subProcess);

    const subProcessStartEvents: Array<Model.Events.StartEvent> = subProcessModelFacade.getStartEvents();
    const subProcessStartEvent: Model.Events.StartEvent = subProcessStartEvents[0];

    const subProcessInstanceId: string = uuid.v4();

    const currentResults: any = processTokenFacade.getAllResults();

    const subProcessTokenFacade: IProcessTokenFacade =
      new ProcessTokenFacade(subProcessInstanceId, this.subProcess.id, currentProcessToken.correlationId, identity);

    subProcessTokenFacade.importResults(currentResults);
    subProcessTokenFacade.addResultForFlowNode(subProcessStartEvent.id, currentProcessToken.payload);

    const subProcessToken: Runtime.Types.ProcessToken = subProcessTokenFacade.createProcessToken(currentProcessToken.payload);
    subProcessToken.caller = currentProcessToken.processInstanceId;

    try {
      const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> =
        await this.flowNodeHandlerFactory.create(subProcessStartEvent, processModelFacade);

      await flowNodeHandler.execute(subProcessToken, subProcessTokenFacade, subProcessModelFacade, identity);

      // After all FlowNodes in the SubProcess have been executed, set the last "current" token value as a result of the whole SubProcess
      // and on the original ProcessTokenFacade, so that is is accessible by the original Process
      const subProcessTokenData: any = await subProcessTokenFacade.getOldTokenFormat();
      const subProcessResult: any = subProcessTokenData.current || {};

      return subProcessResult;
    } catch (error) {
      // We must change the state of the Subprocess here, or it will remain in a suspended state forever.
      this.logger.error(error);

      await this.persistOnError(currentProcessToken, error);

      throw error;
    }
  }

  private async _resumeSubProcess(
    flowNodeInstancesForSubprocess: Array<Runtime.Types.FlowNodeInstance>,
    currentProcessToken: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    identity: IIdentity,
  ): Promise<any> {

    const subProcessModelFacade: IProcessModelFacade = processModelFacade.getSubProcessModelFacade(this.subProcess);

    const subProcessStartEvents: Array<Model.Events.StartEvent> = subProcessModelFacade.getStartEvents();
    const subProcessStartEvent: Model.Events.StartEvent = subProcessStartEvents[0];

    const currentResults: any = processTokenFacade.getAllResults();

    const subProcessInstanceId: string = flowNodeInstancesForSubprocess[0].processInstanceId;

    const subProcessTokenFacade: IProcessTokenFacade =
      new ProcessTokenFacade(subProcessInstanceId, this.subProcess.id, currentProcessToken.correlationId, identity);

    subProcessTokenFacade.importResults(currentResults);
    subProcessTokenFacade.addResultForFlowNode(subProcessStartEvent.id, currentProcessToken.payload);

    const subProcessToken: Runtime.Types.ProcessToken = subProcessTokenFacade.createProcessToken(currentProcessToken.payload);

    try {
      const flowNodeInstanceForStartEvent: Runtime.Types.FlowNodeInstance =
        flowNodeInstancesForSubprocess.find((entry: Runtime.Types.FlowNodeInstance): boolean => {
          return entry.flowNodeId === subProcessStartEvent.id;
        });

      const flowNodeHandler: IFlowNodeHandler<Model.Base.FlowNode> =
        await this.flowNodeHandlerFactory.create(subProcessStartEvent, processModelFacade);

      const startEventWasNotYetStarted: boolean = !flowNodeInstanceForStartEvent;
      if (startEventWasNotYetStarted) {
        await flowNodeHandler.execute(subProcessToken, subProcessTokenFacade, subProcessModelFacade, identity);
      }

      await flowNodeHandler.resume(flowNodeInstancesForSubprocess, subProcessTokenFacade, subProcessModelFacade, identity);

      // After all FlowNodes in the SubProcess have been executed, set the last "current" token value as a result of the whole SubProcess
      // and on the original ProcessTokenFacade, so that is is accessible by the original Process
      const subProcessTokenData: any = await subProcessTokenFacade.getOldTokenFormat();
      const subProcessResult: any = subProcessTokenData.current || {};

      return subProcessResult;
    } catch (error) {
      // We must change the state of the Subprocess here, or it will remain in a suspended state forever.
      this.logger.error(error);

      await this.persistOnError(currentProcessToken, error);

      throw error;
    }
  }
}
