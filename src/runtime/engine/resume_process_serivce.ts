import {IResumeProcessService} from '@process-engine/process_engine_contracts';

export class ResumeProcessService implements IResumeProcessService {

  public async findAndResumeInterruptedProcessInstances(): Promise<void> {
    return Promise.resolve();
  }

}
