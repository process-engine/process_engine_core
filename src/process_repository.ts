import {DependencyInjectionContainer} from 'addict-ioc';
import {IProcessRepository} from '@process-engine-js/process_engine_contracts';

import * as bluebirdPromise from 'bluebird';
import * as path from 'path';
import * as fs from 'fs';

interface IProcessCache {
  [name: string]: IProcessCacheEntry;
}

interface IProcessCacheEntry {
  name: string;
  process: string;
  category: string;
  module: string;
  path: string;
  readonly: boolean;
}

export class ProcessRepository implements IProcessRepository {
  
  private _container: DependencyInjectionContainer = undefined;

  private _processCache: IProcessCache = {};

  constructor(container: DependencyInjectionContainer) {
    this._container = container;
  }

  private get container(): DependencyInjectionContainer {
    return this._container;
  }

  private get processCache(): IProcessCache {
    return this._processCache;
  }

  public get processKeys(): Array<string> {
    return Object.keys(this.processCache);
  }

  public initialize(): void {
    this._loadStaticProcesses();
  }

  public getProcess(processName: string): string {
    const entry = this._getEntry(processName);
    return entry.process;
  }

  public getProcessesByCategory(category: string): Array<string> {
    const entries = this._getEntriesByCategory(category);
    return entries.map((entry) => {
      return entry.process;
    });
  }

  public saveProcess(processName: string, processXml?: string): Promise<void> {

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
        } else {
          resolve();
        }
      });
    });
  }

  private _updateProcess(processName: string, processXml: string): void {
    const entry = this._getEntry(processName);
    entry.process = processXml;
  }

  private _loadStaticProcesses(): void {

    const entries = this._getEntriesByCategory('internal');

    entries.forEach((entry) => {
      this._cacheEntry(entry);
    });
  }

  private _cacheEntry(entry: IProcessCacheEntry): void {
    this._processCache[entry.name] = entry;
  }

  private _getEntry(processName: string): IProcessCacheEntry {
    return this._processCache[processName];
  }

  private _getEntriesByCategory(category: string): Array<any> {

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