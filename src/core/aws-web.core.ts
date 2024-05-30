import { WebCoreConfig, WebCoreService } from '../types';
import { AWSStorageService } from '../token-storage';

export class AWSWebCore implements WebCoreService {
    private tokenStorage: AWSStorageService;
    private readonly region: string = 'ap-northeast-2';

    constructor(private readonly config: WebCoreConfig<'aws'>) {
        this.region = this.config.region || 'ap-northeast-2';
        this.createTokenStorage();
    }

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

    private createTokenStorage() {
        const { storage, project, cloud } = this.config;
        this.tokenStorage = new AWSStorageService({ cloud, project, storage });
    }
}
