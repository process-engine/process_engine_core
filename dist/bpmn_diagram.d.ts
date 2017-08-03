import { IBpmnDiagram } from '@process-engine-js/process_engine_contracts';
export declare class BpmnDiagram implements IBpmnDiagram {
    private _definitions;
    constructor(definitions: any);
    readonly definitions: any;
    getProcesses(): any;
    getParticipants(): any;
    getLanes(processId: string): any;
    getLaneOfElement(elementId: string): any;
    getNodes(processId: string): any;
    getFlows(processId: string): any;
    private _getProcessById(processId);
    getSignals(): any;
    getSignalById(signalId: string): any;
    getMessages(): any;
    getMessageById(messageId: string): any;
    getErrors(): any;
    getErrorById(errorId: string): any;
}
