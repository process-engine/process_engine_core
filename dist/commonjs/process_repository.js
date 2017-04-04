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
    _loadStaticProcesses() {
        const processKeys = this.container.getKeysByAttributes({
            bpmn_process: 'internal'
        });
        processKeys.forEach((processKey) => {
            const registration = this.container._getRegistration(processKey);
            const entry = {
                process: registration.settings.type,
                category: registration.settings.tags['bpmn_process'],
                module: registration.settings.tags['module'],
                path: registration.settings.tags['path'],
                readonly: registration.settings.tags['readonly'] !== undefined
            };
            this.processCache[processKey] = entry;
        });
    }
    _getEntry(processKey) {
        return this._processCache[processKey];
    }
    getProcess(processKey) {
        const entry = this._getEntry(processKey);
        return entry.process;
    }
    saveProcess(processKey) {
        return new bluebirdPromise((resolve, reject) => {
            const entry = this._getEntry(processKey);
            if (entry.readonly) {
                throw new Error(`process ${processKey} is readonly and mustn't be saved`);
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
}
exports.ProcessRepository = ProcessRepository;

//# sourceMappingURL=process_repository.js.map
