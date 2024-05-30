import { LemonOAuthToken, WebCoreConfig } from '../types';
import { TokenStorageService } from './token-storage.service';

export class AzureStorageService extends TokenStorageService {
    private credentialKeys = ['accountId', 'authId', 'identityId', 'identityToken', 'accessToken', 'hostKey', 'expiredTime'];

    constructor(readonly config: WebCoreConfig<'azure'>) {
        super(config);
    }

    async getAllItems() {
        return await this.credentialKeys.reduce(async (promise, item) => {
            const result: { [key: string]: string } = await promise.then();
            result[`${this.prefix}.${item}`] = await this.storage.getItem(`${this.prefix}.${item}`);
            return Promise.resolve(result);
        }, Promise.resolve({}));
    }

    async hasCachedToken(): Promise<boolean> {
        const expiredTime = await this.storage.getItem(`${this.prefix}.expiredTime`);
        const identityToken = await this.storage.getItem(`${this.prefix}.identityToken`);
        const accessToken = await this.storage.getItem(`${this.prefix}.accessToken`);
        const hostKey = await this.storage.getItem(`${this.prefix}.hostKey`);

        return identityToken !== null && accessToken !== null && hostKey !== null && expiredTime !== null;
    }

    async shouldRefreshToken(): Promise<boolean> {
        const expiredTime = +(await this.storage.getItem(`${this.prefix}.expiredTime`));
        const now = new Date().getTime();
        return now >= expiredTime;
    }

    async getCachedOAuthToken(): Promise<LemonOAuthToken> {
        const result: any = await this.credentialKeys.reduce(async (promise, item) => {
            const tmp: { [key: string]: string } = await promise.then();
            tmp[item] = await this.storage.getItem(`${this.prefix}.${item}`);
            return Promise.resolve(tmp);
        }, Promise.resolve({}));

        const HostKey = await this.storage.getItem(`${this.prefix}.hostKey`);
        result.credential = { HostKey };

        delete result.hostKey;
        delete result.expiredTime;

        return result as LemonOAuthToken;
    }

    async saveOAuthToken(token: LemonOAuthToken): Promise<void> {
        const { accountId, authId, credential, identityId, identityToken, accessToken } = token;
        const { hostKey } = credential;

        this.storage.setItem(`${this.prefix}.accountId`, accountId || '');
        this.storage.setItem(`${this.prefix}.authId`, authId || '');
        this.storage.setItem(`${this.prefix}.identityId`, identityId || '');
        this.storage.setItem(`${this.prefix}.identityToken`, identityToken || '');

        this.storage.setItem(`${this.prefix}.hostKey`, hostKey || '');
        this.storage.setItem(`${this.prefix}.accessToken`, accessToken || '');

        // set expired time
        const TIME_DELAY = 0.5; // 0.5 = 30minutes, 1 = 1hour
        const expiredTime = new Date().getTime() + TIME_DELAY * 60 * 60 * 1000; // 30 minutes
        this.storage.setItem(`${this.prefix}.expiredTime`, expiredTime.toString());

        return;
    }

    async clearOAuthToken(): Promise<void> {
        await Promise.all(this.credentialKeys.map(item => this.storage.removeItem(`${this.prefix}.${item}`)));
        return;
    }
}
