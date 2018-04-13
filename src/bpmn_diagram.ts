import { IBpmnDiagram } from '@process-engine/process_engine_contracts';

export class BpmnDiagram implements IBpmnDiagram {

  private _definitions: any = undefined;

  constructor(definitions: any) {
    this._definitions = definitions;
  }

  public get definitions(): any {
    return this._definitions;
  }

  public getProcesses(): any {

    const processes: any = [];

    this.definitions.rootElements.forEach((root) => {

      if (root.$type === 'bpmn:Process') {
        processes.push(root);
      }
    });

    return processes;
  }

  public getParticipants(): any {

    let participants: any;

    this.definitions.rootElements.forEach((root) => {

      if (root.$type === 'bpmn:Collaboration') {
        participants = root.participants;
      }
    });

    return participants;
  }

  public getLanes(processId: string): any {

    const process = this._getProcessById(processId);

    let lanes = [];
    if (process && process.laneSets) {

      process.laneSets.forEach((laneSet) => {

        lanes = lanes.concat(laneSet.lanes);
      });
    }

    return lanes;
  }

  public getLaneOfElement(elementId: string): any {

    let laneId = null;
    const processes = this.getProcesses();

    processes.forEach((process) => {

      const lanes = this.getLanes(process.id);

      if (lanes) {
        lanes.forEach((lane) => {
          if (lane.flowNodeRef) {
            const result = lane.flowNodeRef.filter((nodeRef) => {
              return nodeRef.id === elementId;
            });

            if (result.length > 0) {
              laneId = lane.id;
            }
          }
        });
      }

    });

    return laneId;
  }

  public getNodes(processId: string): any {

    const process = this._getProcessById(processId);

    // TODO: implement subprocess (sm)
    //  also parse flow elements of subprocesses and return them as regular
    //  nodes - this shouldn't be a problem since the nodes are only retrieved
    //  for execution via flows having them as a target
    //
    //  if we want to support nested subprocesses this needs to be recursive
    //
    //  it would be much cleaner if there was a private method that returned all
    //  flow elements regardless of their hierarchy layer and run the filter
    //  method on the whole collection of all elements

    const nodes: Array<any> = [];

    const flowElements: Array<any> = this._getNodesOfElement(process);
    nodes.push(flowElements);

    for (const flowElement of flowElements) {
      // don't parse sub processes recursively for now to avoid potential errors
      if (flowElement.$type === 'bpmn:SubProcess') {
        const subProcessFlowElements: Array<any> = this._getNodesOfElement(flowElement);
        nodes.push(subProcessFlowElements);
      }
    }


    return nodes;
  }

  private _getNodesOfElement(element: any): Array<any> {

    if (element && element.flowElements) {
      return element.flowElements.filter((flowElement) => {
        return flowElement.$type !== 'bpmn:SequenceFlow';
      });
    }

    return [];
  }

  public getFlows(processId: string): any {

    const process = this._getProcessById(processId);

    // TODO: implement subprocess (sm)
    //  also parse flow elements of subprocesses and return them as regular
    //  nodes - this shouldn't be a problem since the nodes are only retrieved
    //  for execution via flows having them as a target

    const nodes: Array<any> = [];

    const flowElements: Array<any> = this._getFlowsOfElement(process);
    nodes.push(flowElements);

    for (const flowElement of flowElements) {
      // don't parse sub processes recursively for now to avoid potential errors
      if (flowElement.$type === 'bpmn:SubProcess') {
        const subProcessFlowElements: Array<any> = this._getFlowsOfElement(flowElement);
        nodes.push(subProcessFlowElements);
      }
    }


    return nodes;
  }

  private _getFlowsOfElement(element: any): Array<any> {

    if (element && element.flowElements) {
      return element.flowElements.filter((flowElement) => {
        return flowElement.$type === 'bpmn:SequenceFlow';
      });
    }

    return [];
  }

  private _getProcessById(processId: string): any {

    const processes = this.getProcesses();

    const process = processes.find((item) => item.id === processId);

    return process;
  }

  public getSignals(): any {

    const signals: any = [];

    this.definitions.rootElements.forEach((root) => {

      if (root.$type === 'bpmn:Signal') {
        signals.push(root);
      }
    });

    return signals;
  }

  public getSignalById(signalId: string): any {

    const signals = this.getSignals();

    const signal = signals.find((item) => item.id === signalId);

    return signal;
  }

  public getMessages(): any {

    const messages: any = [];

    this.definitions.rootElements.forEach((root) => {

      if (root.$type === 'bpmn:Message') {
        messages.push(root);
      }
    });

    return messages;
  }

  public getMessageById(messageId: string): any {

    const messages = this.getMessages();

    const message = messages.find((item) => item.id === messageId);

    return message;
  }

  public getErrors(): any {

    const errors: any = [];

    this.definitions.rootElements.forEach((root) => {

      if (root.$type === 'bpmn:Error') {
        errors.push(root);
      }
    });

    return errors;
  }

  public getErrorById(errorId: string): any {

    const errors = this.getErrors();
    const error = errors.find((item) => item.id === errorId);
    return error;
  }
}
