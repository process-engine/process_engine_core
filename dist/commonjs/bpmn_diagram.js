"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class BpmnDiagram {
    constructor(definitions) {
        this._definitions = undefined;
        this._definitions = definitions;
    }
    get definitions() {
        return this._definitions;
    }
    getProcesses() {
        const processes = [];
        this.definitions.rootElements.forEach((root) => {
            if (root.$type === 'bpmn:Process') {
                processes.push(root);
            }
        });
        return processes;
    }
    getParticipants() {
        let participants;
        this.definitions.rootElements.forEach((root) => {
            if (root.$type === 'bpmn:Collaboration') {
                participants = root.participants;
            }
        });
        return participants;
    }
    getLanes(processId) {
        const process = this._getProcessById(processId);
        let lanes = [];
        if (process && process.laneSets) {
            process.laneSets.forEach((laneSet) => {
                lanes = lanes.concat(laneSet.lanes);
            });
        }
        return lanes;
    }
    getLaneOfElement(elementId) {
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
    getNodes(processId) {
        const process = this._getProcessById(processId);
        if (process && process.flowElements) {
            return process.flowElements.filter((element) => {
                return element.$type !== 'bpmn:SequenceFlow';
            });
        }
        return [];
    }
    getFlows(processId) {
        const process = this._getProcessById(processId);
        if (process && process.flowElements) {
            return process.flowElements.filter((element) => {
                return element.$type === 'bpmn:SequenceFlow';
            });
        }
        return [];
    }
    _getProcessById(processId) {
        const processes = this.getProcesses();
        const process = processes.find((item) => item.id === processId);
        return process;
    }
    getSignals() {
        const signals = [];
        this.definitions.rootElements.forEach((root) => {
            if (root.$type === 'bpmn:Signal') {
                signals.push(root);
            }
        });
        return signals;
    }
    getSignalById(signalId) {
        const signals = this.getSignals();
        const signal = signals.find((item) => item.id === signalId);
        return signal;
    }
    getMessages() {
        const messages = [];
        this.definitions.rootElements.forEach((root) => {
            if (root.$type === 'bpmn:Message') {
                messages.push(root);
            }
        });
        return messages;
    }
    getMessageById(messageId) {
        const messages = this.getMessages();
        const message = messages.find((item) => item.id === messageId);
        return message;
    }
    getErrors() {
        const errors = [];
        this.definitions.rootElements.forEach((root) => {
            if (root.$type === 'bpmn:Error') {
                errors.push(root);
            }
        });
        return errors;
    }
    getErrorById(errorId) {
        const errors = this.getErrors();
        const error = errors.find((item) => item.id === errorId);
        return error;
    }
}
exports.BpmnDiagram = BpmnDiagram;

//# sourceMappingURL=bpmn_diagram.js.map
