import { AWSWebCore, AzureWebCore } from '../core';

export interface WebCoreService {
    getSavedToken(): Promise<{ [key: string]: string }>;
    request(): Promise<any>;
    isAuthenticated(): Promise<boolean>;
    logout(): Promise<void>;
    setUseXLemonIdentity(use: boolean): void;
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
    oAuthEndpoint: string;
    storage?: Storage;
};

export type WebCoreConstructor<T extends WebCoreService> = new (config: WebCoreConfig<CloudProvider>) => T;
