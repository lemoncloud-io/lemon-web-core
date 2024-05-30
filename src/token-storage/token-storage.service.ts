import { CloudProvider, Storage, TokenStorageConfig } from '../types';
import { LocalStorageService } from '../utils';

export abstract class TokenStorageService {
    protected prefix: string = 'lemon';
    protected storage: Storage = new LocalStorageService();

    constructor(protected readonly config: TokenStorageConfig<CloudProvider>) {
        this.prefix = `${config.project}`;
        this.storage = this.config.storage || new LocalStorageService();
    }

    updatePrefix(prefix: string) {
        this.prefix = `@${prefix}`;
    }

    async setItem(key: string, value: string): Promise<void> {
        return await this.storage.setItem(`${this.prefix}.${key}`, value);
    }

    async getItem(key: string): Promise<string> {
        return await this.storage.getItem(`${this.prefix}.${key}`);
    }

    abstract getAllItems(): Promise<{ [key: string]: string }>;
    abstract hasCachedToken(): Promise<boolean>;
    abstract shouldRefreshToken(): Promise<boolean>;
}
