import {InternalServerError} from '@essential-projects/errors_ts';
import {
  IProcessTokenFacade,
  Model,
  OnBoundaryEventTriggeredCallback,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {BoundaryEventHandler} from './boundary_event_handler';
export class ErrorBoundaryEventHandler extends BoundaryEventHandler {

  /**
   * Checks if the message of the given error is equal to the one attached
   * to the BoundaryEvent model.
   *
   * If no error is attached to the model, then this handler can also handle
   * the error.
   * @param error The error to compare against the errorDefinition of the model.
   */
  public canHandleError(error: Error): boolean {

    const errorDefinition: Model.EventDefinitions.ErrorEventDefinition = this._boundaryEventModel.errorEventDefinition;

    const modelHasNoErrorDefinition: boolean = !errorDefinition || !errorDefinition.name || errorDefinition.name === '';
    if (modelHasNoErrorDefinition) {
      return true;
    }

    // The Code property is optional and must only be evaluated, if the definition contains it.
    // Also, modelled error codes need not necessarily be numbers, which prevents a cast to an Essential-Project Error.
    // Therefore, using "any" is acceptable here.
    const errorCodesMatch: boolean = (!errorDefinition.code || errorDefinition.code === '') || errorDefinition.code === (error as any).code;
    const errorMessageMatchesName: boolean = errorDefinition.name === error.message;

    const isMatch: boolean = errorCodesMatch && errorMessageMatchesName;

    return isMatch;
  }

  public async waitForTriggeringEvent(
    onTriggeredCallback: OnBoundaryEventTriggeredCallback,
    token: Runtime.Types.ProcessToken,
    processTokenFacade: IProcessTokenFacade,
  ): Promise<void> {

    // ErrorBoundaryEvents are a special case,
    // in that they do not wait for any event to happen,
    // but will only change the ProcessInstance's path,
    // if an error was intercepted during the decorated handlers execution.
    const errorMessage: string =
      'ErrorBoundaryEvents cannot be awaited! Use "getNextFlowNode" on this BoundaryEvent, when the decorated handler encounters an error!';
    throw new InternalServerError(errorMessage);
  }
}
