import { ExecutionContext } from '@essential-projects/core_contracts';
import { IExecutionContextFascade } from '@process-engine/process_engine_contracts';

export class ExecutionContextFascade implements IExecutionContextFascade {

  private _context: ExecutionContext = undefined;

  constructor(context: ExecutionContext) {
    this._context = context;
  }

  private get context(): ExecutionContext {
    return this._context;
  }

  public getIdentityToken(): string {
    return this.context.encryptedToken;
  }

}
