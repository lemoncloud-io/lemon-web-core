/**
 * Represents the supported cloud providers.
 * @typedef {'aws' | 'azure'} CloudProvider
 */
export type CloudProvider = 'aws' | 'azure';

/**
 * Default options for initializing the service.
 * @interface LemonOptions
 * @property {string} project - The project name or identifier.
 * @property {CloudProvider} cloud - The cloud provider (either 'aws' or 'azure').
 * @property {string} oAuthEndpoint - The OAuth endpoint URL.
 */
export interface LemonOptions {
    project: string;
    cloud: CloudProvider;
    oAuthEndpoint: string;
}
