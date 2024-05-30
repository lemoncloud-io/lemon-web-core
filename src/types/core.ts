import { AWSWebCore, AzureWebCore } from '../core';

export interface WebCoreService {
    getAllTokens(): Promise<{ [key: string]: string }>;
    request(): Promise<any>;
    isAuthenticated(): Promise<boolean>;
    logout(): Promise<boolean>;
    useXLemonIdentity(): void;
}

export type WebCoreServiceMap = {
    aws: AWSWebCore;
    azure: AzureWebCore;
};

export type CloudProvider = keyof WebCoreServiceMap;

export type WebCoreConfig<T extends CloudProvider> = {
    cloud: T;
    region: string;
    project: string;
    storage?: Storage;
};

export type WebCoreConstructor<T extends WebCoreService> = new (config: WebCoreConfig<CloudProvider>) => T;

// const awsService = TokenStorageFactory.createService({ cloud: 'aws', region: 'us-west-1', project: 'test' });
// awsService.performAction();  // Performing action on AWS in region us-west-1
//
// const azureService = TokenStorageFactory.createService({ cloud: 'azure', region: 'east-us', project: 'test' });
// azureService.performAction();  // Performing action on Azure in region east-us
//
// const gcpService = TokenStorageFactory.createService({ cloud: 'gcp', region: 'asia-south1', project: 'test' });
// gcpService.performAction();  // Performing action on GCP in region asia-south1
