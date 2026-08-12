import { AWSWebCore } from './aws-web.core';
import { AzureWebCore } from './azure-web.core';
import { CloudProvider, WebCoreConfig, WebCoreConstructor, WebCoreServiceMap } from '../types';

/**
 * A map of cloud provider to their corresponding WebCore constructor.
 * Each entry is keyed to its own provider, so `aws` maps to a constructor taking `WebCoreConfig<'aws'>`
 * rather than one taking any provider's config.
 */
const webCoreMap: { [T in CloudProvider]: WebCoreConstructor<T> } = {
    aws: AWSWebCore,
    azure: AzureWebCore,
};

/**
 * A factory class to create instances of {@link WebCoreService} based on the cloud provider.
 */
export class WebCoreFactory {
    /**
     * Creates an instance of {@link WebCoreService} based on the provided configuration.
     *
     * @param config The configuration for the WebCore service.
     * @returns An instance of {@link WebCoreService} specific to the cloud provider.
     * @throws Error if the cloud provider is not supported.
     */
    static create<T extends CloudProvider>(config: WebCoreConfig<T>): WebCoreServiceMap[T] {
        const { cloud } = config;
        const ServiceConstructor = webCoreMap[cloud];
        if (!ServiceConstructor) {
            throw new Error('Unsupported cloud provider');
        }
        return new ServiceConstructor(config);
    }
}
