import { CloudProvider, LemonOptions } from '../types';

/**
 * Abstract class representing a cloud service.
 * @abstract
 */
export abstract class CloudService {
    protected project: string;
    protected cloud: CloudProvider;
    protected oAuthEndpoint: string;

    /**
     * Creates an instance of CloudService.
     * @param {LemonOptions} options - The initialization options.
     * @param {string} options.project - The project name or identifier.
     * @param {CloudProvider} options.cloud - The cloud provider (either 'aws' or 'azure').
     * @param {string} options.oAuthEndpoint - The OAuth endpoint URL.
     */
    protected constructor(options: LemonOptions) {
        const { project, cloud, oAuthEndpoint } = options;
        this.project = project;
        this.cloud = cloud;
        this.oAuthEndpoint = oAuthEndpoint;
    }
}
