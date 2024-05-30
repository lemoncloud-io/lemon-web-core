import { WebCoreConfig, WebCoreService } from '../types';

// TODO: implment Azure Core
export class AzureWebCore implements WebCoreService {
    constructor(private readonly config: WebCoreConfig<'azure'>) {}
    isAuthenticated(): Promise<boolean> {
        return Promise.resolve(false);
    }

    logout(): Promise<void> {
        return;
    }

    request(): Promise<any> {
        return Promise.resolve(undefined);
    }

    setUseXLemonIdentity(): void {}

    getSavedToken(): Promise<{ [p: string]: string }> {
        return Promise.resolve({});
    }
}
