"use strict";
const bluebirdPromise = require("bluebird");
const path = require("path");
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
        const entry = this._getEntry(processName);
        return entry.process;
    }
    getProcessesByCategory(category) {
        const entries = this._getEntriesByCategory(category);
        return entries.map((entry) => {
            return entry.process;
        });
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
            const processPath = path.join(process.cwd(), entry.module, entry.path);
            fs.writeFile(processPath, entry.process, (error) => {
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
        entry.process = processXml;
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
        const processNames = this.container.getKeysByAttributes({
            bpmn_process: category
        });
        return processNames.map((processName) => {
            const registration = this.container._getRegistration(processName);
            const entry = {
                name: processName,
                process: registration.settings.type,
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
