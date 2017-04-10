"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bluebirdPromise = require("bluebird");
const fs = require("fs");
class ProcessRepository {
    constructor(container) {
        this._container = undefined;
        this._processCache = {};
        this._container = container;
    }
    get container() {
        return this._container;
    }
    get processCache() {
        return this._processCache;
    }
    get processKeys() {
        return Object.keys(this.processCache);
    }
    initialize() {
        this._loadStaticProcesses();
    }
    getProcess(processName) {
        return this._getEntry(processName);
    }
    getProcessesByCategory(category) {
        return this._getEntriesByCategory(category);
    }
    saveProcess(processName, processXml) {
        return new bluebirdPromise((resolve, reject) => {
            const entry = this._getEntry(processName);
            if (processXml) {
                this._updateProcess(processName, processXml);
            }
            if (entry.readonly) {
                throw new Error(`process ${processName} is readonly and mustn't be saved`);
            }
            fs.writeFile(entry.path, entry.bpmnXml, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    _updateProcess(processName, processXml) {
        const entry = this._getEntry(processName);
        entry.bpmnXml = processXml;
    }
    _loadStaticProcesses() {
        const entries = this._getEntriesByCategory('internal');
        entries.forEach((entry) => {
            this._cacheEntry(entry);
        });
    }
    _cacheEntry(entry) {
        this._processCache[entry.name] = entry;
    }
    _getEntry(processName) {
        return this._processCache[processName];
    }
    _getEntriesByCategory(category) {
        const container = this.container;
        const processNames = container.getKeysByAttributes({
            bpmn_process: category
        });
        return processNames.map((processName) => {
            const registration = container._getRegistration(processName);
            const entry = {
                name: processName,
                bpmnXml: registration.settings.type,
                category: registration.settings.tags['bpmn_process'],
                module: registration.settings.tags['module'],
                path: registration.settings.tags['path'],
                readonly: registration.settings.tags['readonly'] !== undefined
            };
            return entry;
        });
    }
}
exports.ProcessRepository = ProcessRepository;

//# sourceMappingURL=process_repository.js.map
