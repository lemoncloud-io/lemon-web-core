let dataMemory: any = {};

class MemoryStorage {
    constructor() {}

    public setItem(key: string, value: string) {
        dataMemory[key] = value;
        return dataMemory[key];
    }

    public getItem(key: string) {
        return Object.prototype.hasOwnProperty.call(dataMemory, key) ? dataMemory[key] : undefined;
    }

    public removeItem(key: string) {
        return delete dataMemory[key];
    }

    public clear() {
        dataMemory = {};
        return dataMemory;
    }
}

export class LocalStorageService {
    private storage: any;

    constructor() {
        try {
            this.storage = window.localStorage;
            this.storage.setItem(`.test-value`, 1);
            this.storage.removeItem(`.test-value`);
        } catch (exception) {
            this.storage = new MemoryStorage();
        }
    }

    public setItem(key: string, value: string) {
        this.storage.setItem(key, value);
    }

    public getItem(key: string) {
        return this.storage.getItem(key);
    }

    public removeItem(key: string) {
        this.storage.removeItem(key);
    }
}
