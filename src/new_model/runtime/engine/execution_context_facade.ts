import {IIdentity} from '@essential-projects/iam_contracts';
import {ExecutionContext, IExecutionContextFacade} from '@process-engine/process_engine_contracts';

export class ExecutionContextFacade implements IExecutionContextFacade {

  private _context: ExecutionContext = undefined;

  constructor(context: ExecutionContext) {
    this._context = context;
  }

  public getIdentity(): IIdentity {
    return this._context.identity;
  }

  public getExecutionContext(): ExecutionContext {
    return this._context;
  }

}
