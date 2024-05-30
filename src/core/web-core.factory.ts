import { AWSWebCore } from './aws-web.core';
import { AzureWebCore } from './azure-web.core';
import { CloudProvider, WebCoreConfig, WebCoreConstructor, WebCoreService, WebCoreServiceMap } from '../types';

const webCoreMap: Record<CloudProvider, WebCoreConstructor<WebCoreService>> = {
    aws: AWSWebCore,
    azure: AzureWebCore,
};

export class WebCoreFactory {
    static create<T extends CloudProvider>(config: WebCoreConfig<T>): WebCoreServiceMap[T] {
        const { cloud } = config;
        const ServiceConstructor = webCoreMap[cloud] as WebCoreConstructor<WebCoreServiceMap[T]>;
        if (!ServiceConstructor) {
            throw new Error('Unsupported cloud provider');
        }
        return new ServiceConstructor(config);
    }
}

// const awsService = WebCoreFactory.create({ cloud: 'aws', region: 'us-west-1', project: 'test' });
// awsService.test()
