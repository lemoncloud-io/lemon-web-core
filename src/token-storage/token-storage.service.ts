import { CloudProvider, Storage, WebCoreConfig } from '../types';
import { LocalStorageService } from '../utils';

export const USE_X_LEMON_IDENTITY_KEY = 'use_x_lemon_identity_key';
export const USE_X_LEMON_LANGUAGE_KEY = 'use_x_lemon_language_key';
export const REGION_KEY = 'region';

/**
 * Abstract class representing a token storage service.
 * Provides methods to set and get items in storage, and abstract methods
 * to check and manage cached tokens.
 */
export abstract class TokenStorageService {
    protected prefix: string = 'lemon';
    protected storage: Storage = new LocalStorageService();

    /**
     * Constructs a TokenStorageService instance.
     * @param {WebCoreConfig<CloudProvider>} config - The configuration for the web core.
     */
    constructor(protected readonly config: WebCoreConfig<CloudProvider>) {
        this.prefix = `@${config.project}`;
        this.storage = this.config.storage || new LocalStorageService();
    }

    /**
     * Updates the prefix used in storage keys.
     * @param {string} prefix - The new prefix to use.
     */
    updatePrefix(prefix: string) {
        this.prefix = `@${prefix}`;
    }

    /**
     * Sets an item in the storage.
     * @param {string} key - The key to set.
     * @param {string} value - The value to set.
     * @returns {Promise<void>} - A promise that resolves when the item is set.
     */
    async setItem(key: string, value: string): Promise<void> {
        return await this.storage.setItem(`${this.prefix}.${key}`, value);
    }

    /**
     * Gets an item from the storage.
     * @param {string} key - The key to get.
     * @returns {Promise<string>} - A promise that resolves to the value of the item.
     */
    async getItem(key: string): Promise<string> {
        return await this.storage.getItem(`${this.prefix}.${key}`);
    }

    /**
     * Gets all items from the storage.
     * @returns {Promise<{ [key: string]: string }>} - A promise that resolves to an object containing all items.
     */
    abstract getAllItems(): Promise<{ [key: string]: string }>;

    /**
     * Checks if there is a cached token in the storage.
     * @returns {Promise<boolean>} - A promise that resolves to true if a cached token exists, false otherwise.
     */
    abstract hasCachedToken(): Promise<boolean>;

    /**
     * Checks if the cached token should be refreshed.
     * @returns {Promise<boolean>} - A promise that resolves to true if the token should be refreshed, false otherwise.
     */
    abstract shouldRefreshToken(): Promise<boolean>;
}
