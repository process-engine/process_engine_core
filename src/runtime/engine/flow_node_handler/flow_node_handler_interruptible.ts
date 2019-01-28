import {
  IInterruptible,
  Model,
  onInterruptionCallback,
  Runtime,
} from '@process-engine/process_engine_contracts';

import {FlowNodeHandler} from './flow_node_handler';

export abstract class FlowNodeHandlerInterruptible<TFlowNode extends Model.Base.FlowNode>
  extends FlowNodeHandler<TFlowNode>
  implements IInterruptible {

    // tslint:disable-next-line:no-empty
  private _onInterruptedCallback: onInterruptionCallback = (): void => { };

  /**
   * Gets the callback that gets called when an interrupt-command was received.
   * This can be used by the derived handlers to perform handler-specific actions
   * necessary for stopping its work cleanly.
   */
  protected get onInterruptedCallback(): onInterruptionCallback {
    return this._onInterruptedCallback;
  }

  /**
   * Sets the callback that gets called when an interrupt-command was received.
   */
  protected set onInterruptedCallback(value: onInterruptionCallback) {
    this._onInterruptedCallback = value;
  }

  public async interrupt(token: Runtime.Types.ProcessToken, terminate?: boolean): Promise<void> {
    await this.onInterruptedCallback(token);

    if (terminate) {
      return this.persistOnTerminate(token);
    }

    return this.persistOnExit(token);
  }
}
