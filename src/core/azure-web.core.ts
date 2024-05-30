import { WebCoreConfig, WebCoreService } from '../types';

export class AzureWebCore implements WebCoreService {
    constructor(private readonly config: WebCoreConfig<'azure'>) {}

    isAuthenticated(): Promise<boolean> {
        return Promise.resolve(false);
    }

    logout(): Promise<boolean> {
        return Promise.resolve(false);
    }

    request(): Promise<any> {
        return Promise.resolve(undefined);
    }

    getAllTokens(): Promise<{ [p: string]: string }> {
        return Promise.resolve({});
    }

    useXLemonIdentity(): void {}
}
