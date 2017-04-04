import {DependencyInjectionContainer} from 'addict-ioc';

import * as bluebirdPromise from 'bluebird';
import * as path from 'path';
import * as fs from 'fs';

interface IProcessCache {
  [key: string]: IProcessCacheEntry;
}

interface IProcessCacheEntry {
  process: any;
  category: string;
  module: string;
  path: string;
  readonly: boolean;
}

export class ProcessRepository {
  
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

  private _loadStaticProcesses(): void {

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

  private _getEntry(processKey: string): IProcessCacheEntry {
    return this._processCache[processKey];
  }

  public getProcess(processKey: string): any {
    const entry = this._getEntry(processKey);
    return entry.process;
  }

  public saveProcess(processKey: string): Promise<void> {

    return new bluebirdPromise((resolve, reject) => {

      const entry = this._getEntry(processKey);

      if (entry.readonly) {
        throw new Error(`process ${processKey} is readonly and mustn't be saved`);
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
}