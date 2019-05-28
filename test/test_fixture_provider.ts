import * as fs from 'fs';
import * as should from 'should';

import * as Bluebird from 'bluebird';

import {IIdentity} from '@essential-projects/iam_contracts';

import {Model} from '@process-engine/process_model.contracts';

import {BpmnModelParser} from '../src/model/bpmn_model_parser';
import {ProcessModelFacade, ProcessTokenFacade} from '../src/runtime';

Bluebird.config({
  cancellation: true,
});

global.Promise = Bluebird;

const sampleResultsForProcessTokenFacade = [{
  flowNodeId: 'StartEvent_1',
  flowNodeInstanceId: 'abcdefg',
  payload: {
    testProperty: 'hello world',
  },
}, {
  flowNodeId: 'ServiceTask_1',
  flowNodeInstanceId: 'ffffdf1123',
  payload: {},
}, {
  flowNodeId: 'EndEvent_1',
  flowNodeInstanceId: '132112341233124',
  payload: {
    endResult: 'Dakka.',
  },
}];

export class TestFixtureProvider {

  // eslint-disable-next-line @typescript-eslint/member-naming
  private readonly _sampleIdentity: IIdentity = {
    userId: 'sampleUser',
    token: 'sampleToken',
  };

  private parser: BpmnModelParser;

  public async initialize(): Promise<void> {
    this.parser = new BpmnModelParser();
    await this.parser.initialize();
  }

  public get sampleIdentity(): IIdentity {
    return this._sampleIdentity;
  }

  public async parseProcessModelFromFile(bpmnFilename: string): Promise<Model.Process> {
    const bpmnXml = fs.readFileSync(bpmnFilename, 'utf8');
    const definitions = await this.parser.parseXmlToObjectModel(bpmnXml);

    return definitions.processes[0];
  }

  public createProcessModelFacade(processModel: Model.Process): ProcessModelFacade {
    return new ProcessModelFacade(processModel);
  }

  public createProcessTokenFacade(processInstanceId?: string, proessModelId?: string, correlationId?: string): ProcessTokenFacade {
    // Allow for default values, because only few tests will require assertions for these properties.
    const processInstanceIdToUse = processInstanceId || 'processInstanceId';
    const proessModelIdToUse = proessModelId || 'processModelId';
    const correlationIdToUse = correlationId || 'correlationId';

    return new ProcessTokenFacade(processInstanceIdToUse, proessModelIdToUse, correlationIdToUse, this.sampleIdentity);
  }

  public addSampleResultsToProcessTokenFacade(processTokenFacade: ProcessTokenFacade): void {
    for (const result of sampleResultsForProcessTokenFacade) {
      processTokenFacade.addResultForFlowNode(result.flowNodeId, result.flowNodeInstanceId, result.payload);
    }
  }

  public async assertThatProcessModelHasFlowNodes(processModel: Model.Process, expectedFlowNodeIds: Array<string>): Promise<void> {

    for (const flowNodeId of expectedFlowNodeIds) {
      const flowNodeFound = processModel.flowNodes.some((flowNode: Model.Base.FlowNode): boolean => flowNode.id === flowNodeId);

      should(flowNodeFound).be.true(`Failed to locate FlowNode '${flowNodeId}' in ProcessModel ${processModel.id}!`);
    }
  }

}
