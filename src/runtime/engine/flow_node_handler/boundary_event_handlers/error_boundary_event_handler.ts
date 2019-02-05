import {InternalServerError} from '@essential-projects/errors_ts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {
  IProcessTokenFacade,
  OnBoundaryEventTriggeredCallback,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {BoundaryEventHandler} from './boundary_event_handler';
export class ErrorBoundaryEventHandler extends BoundaryEventHandler {

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
