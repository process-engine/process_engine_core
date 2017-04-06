import { DependencyInjectionContainer } from 'addict-ioc';
import { IProcessRepository } from '@process-engine-js/process_engine_contracts';
export declare class ProcessRepository implements IProcessRepository {
    private _container;
    private _processCache;
    constructor(container: DependencyInjectionContainer);
    private readonly container;
    private readonly processCache;
    readonly processKeys: Array<string>;
    initialize(): void;
    getProcess(processName: string): string;
    getProcessesByCategory(category: string): Array<string>;
    saveProcess(processName: string, processXml?: string): Promise<void>;
    private _updateProcess(processName, processXml);
    private _loadStaticProcesses();
    private _cacheEntry(entry);
    private _getEntry(processName);
    private _getEntriesByCategory(category);
}
