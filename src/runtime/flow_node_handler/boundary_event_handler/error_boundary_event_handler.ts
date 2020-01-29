import {FlowNodeInstance, ProcessToken} from '@process-engine/persistence_api.contracts';
import {
  BpmnError,
  IProcessModelFacade,
  IProcessTokenFacade,
  OnBoundaryEventTriggeredCallback,
} from '@process-engine/process_engine_contracts';

import {BoundaryEventHandler} from './boundary_event_handler';

export class ErrorBoundaryEventHandler extends BoundaryEventHandler {

  /**
   * Checks if the name of the given error is equal to the one attached
   * to the BoundaryEvent model.
   *
   * If no error is attached to the model, then this handler can also handle
   * the error.
   *
   * @param   error The error to compare against the errorEventDefinition of
   *                the model.
   * @param token    Contains all the information required for the notification message.
   * @returns       True, if the BoundaryEvent can handle the given error.
   *                Otherwise false.
   */
  public canHandleError(error: BpmnError, token: ProcessToken): boolean {

    const errorDefinition = this.boundaryEventModel.errorEventDefinition;

    if (!errorDefinition) {
      return true;
    }

    const boundaryEventCanHandleError = this.checkIfErrorMatches(error);
    if (boundaryEventCanHandleError) {
      this.sendBoundaryEventTriggeredNotification(token);
    }

    return boundaryEventCanHandleError;
  }

  public async waitForTriggeringEvent(
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    attachedFlowNodeInstanceId: string,
  ): Promise<void> {

    const laneContainingCurrentFlowNode = processModelFacade.getLaneForFlowNode(this.boundaryEventModel.id);
    if (laneContainingCurrentFlowNode != undefined) {
      token.currentLane = laneContainingCurrentFlowNode.name;
    }
    await this.persistOnEnter(token);

    this.attachedFlowNodeInstanceId = attachedFlowNodeInstanceId;
  }

  public async resumeWait(
    boundaryEventInstance: FlowNodeInstance,
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
    token: ProcessToken, processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    attachedFlowNodeInstanceId: string,
  ): Promise<void> {

    this.boundaryEventInstance = boundaryEventInstance;
    this.attachedFlowNodeInstanceId = attachedFlowNodeInstanceId;
  }

  private checkIfErrorMatches(error: BpmnError): boolean {

    const errorDefinition = this.boundaryEventModel.errorEventDefinition;

    const errorDefinitionHasNoCode = !errorDefinition.code || errorDefinition.code === '';
    const codeMatches = errorDefinitionHasNoCode || `${errorDefinition.code}` === `${error.code}`;

    const errorDefinitionHasNoMessage = !errorDefinition.message || errorDefinition.message === '';
    const messageMatches = errorDefinitionHasNoMessage || errorDefinition.message === error.message;

    const isMatch = codeMatches && messageMatches;

    return isMatch;
  }

}
