import { AWSStorageService, AzureStorageService } from '../token-storage';
import { CloudProvider } from './core';
import { Storage } from './lemon';
import { TokenStorageService } from '../token-storage/token-storage.service';

export type TokenStorageServiceMap = {
    aws: AWSStorageService;
    azure: AzureStorageService;
};

export type TokenStorageConfig<T extends CloudProvider> = {
    cloud: T;
    project: string;
    storage?: Storage; // NOTE: local storage or session storage
};

export type TokenStorageServiceConstructor<T extends TokenStorageService> = new (config: TokenStorageConfig<CloudProvider>) => T;
