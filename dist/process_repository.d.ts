import { DependencyInjectionContainer } from 'addict-ioc';
export declare class ProcessRepository {
    private _container;
    private _processCache;
    constructor(container: DependencyInjectionContainer);
    private readonly container;
    private readonly processCache;
    readonly processKeys: Array<string>;
    initialize(): void;
    private _loadStaticProcesses();
    private _getEntry(processKey);
    getProcess(processKey: string): any;
    saveProcess(processKey: string): Promise<void>;
}
