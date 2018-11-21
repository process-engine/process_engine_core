import {IResumeProcessService} from '@process-engine/process_engine_contracts';

export class ResumeProcessService implements IResumeProcessService {

  public async findAndResumeInterruptedProcessInstances(): Promise<void> {
    return Promise.resolve();
  }

  public async resumeProcessInstanceById(processInstanceId: string): Promise<any> {
    return Promise.resolve();
  }

}
