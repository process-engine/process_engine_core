export class ServiceTaskExtensions {
    private _module: string = null;
    private _method: string = null;
    private _namespace: string = null;
    private _parameter: string = null; 

    constructor(extionsions: any) {
        this.parseExtensions(extionsions);
    }

    public get module(): string {
        return this._module;
    }

    public get method(): string {
        return this._method;
    }

    public get namspace(): string {
        return this._namespace;
    }

    public get parameter(): string {
        return this._parameter;
    }

    public get isValid(): boolean {
        return (this._module != null && this._method != null);
    }

    private parseExtensions(extensions: any): void {
        if (extensions) {
            const props = (extensions && extensions.properties) ? extensions.properties : null;

            if (props) {

                props.forEach((prop) => {
                    if (prop.name === 'module') {
                        this._module = prop.value;
                    }
                    if (prop.name === 'method') {
                        this._method = prop.value;
                    }
                    if (prop.name === 'params') {
                        this._parameter = prop.value;
                    }
                    if (prop.name === 'namespace') {
                        this._namespace = prop.value;
                    }
                });
            }
        }
    }
}