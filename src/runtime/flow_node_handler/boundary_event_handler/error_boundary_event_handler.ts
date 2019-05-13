import {ProcessToken} from '@process-engine/flow_node_instance.contracts';
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
   * @returns       True, if the BoundaryEvent can handle the given error.
   *                Otherwise false.
   */
  public canHandleError(error: Error): boolean {

    const errorDefinition = this.boundaryEventModel.errorEventDefinition;

    const modelHasNoErrorDefinition = !errorDefinition || !errorDefinition.name || errorDefinition.name === '';
    if (modelHasNoErrorDefinition) {
      return true;
    }

    const errorNamesMatch: boolean = errorDefinition.name === error.name;
    // The error code is optional and must only be evaluated, if the definition contains it.
    const errorCodesMatch =
      (!errorDefinition.code || errorDefinition.code === '') ||
      errorDefinition.code === (error as BpmnError).code;

    return errorNamesMatch && errorCodesMatch;
  }

  public async waitForTriggeringEvent(
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
    token: ProcessToken,
    processTokenFacade: IProcessTokenFacade,
    processModelFacade: IProcessModelFacade,
    attachedFlowNodeInstanceId: string,
  ): Promise<void> {

    await this.persistOnEnter(token);

    this.attachedFlowNodeInstanceId = attachedFlowNodeInstanceId;
  }

}
