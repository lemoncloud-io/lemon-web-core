import { AWSWebCore, AzureWebCore } from '../core';

/**
 * Interface representing a web core service.
 */
export interface WebCoreService {
    /**
     * Gets the saved token.
     * @returns {Promise<{ [key: string]: string }>} - A promise that resolves to an object containing the saved token.
     */
    getSavedToken(): Promise<{ [key: string]: string }>;

    /**
     * Checks if the user is authenticated.
     * @returns {Promise<boolean>} - A promise that resolves to true if the user is authenticated, false otherwise.
     */
    isAuthenticated(): Promise<boolean>;

    /**
     * Logs out the user.
     * @returns {Promise<void>} - A promise that resolves when the user is logged out.
     */
    logout(): Promise<void>;

    /**
     * Sets the use of X-Lemon-Identity.
     * @param {boolean} use - Whether to use X-Lemon-Identity.
     */
    setUseXLemonIdentity(use: boolean): void;
}

/**
 * Type representing a map of web core services.
 */
export type WebCoreServiceMap = {
    aws: AWSWebCore;
    azure: AzureWebCore;
};

/**
 * Type representing a cloud provider.
 */
export type CloudProvider = keyof WebCoreServiceMap;

/**
 * Type representing the configuration for the web core.
 * @template T - The cloud provider type.
 */
export type WebCoreConfig<T extends CloudProvider> = {
    cloud: T;
    project: string;
    oAuthEndpoint: string;
    region?: string;
    storage?: Storage;
};

/**
 * Type representing a constructor for a web core service.
 * @template T - The web core service type.
 */
export type WebCoreConstructor<T extends WebCoreService> = new (config: WebCoreConfig<CloudProvider>) => T;
