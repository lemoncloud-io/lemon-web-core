import { TokenStorageService } from './token-storage.service';
import { LemonOAuthToken, WebCoreConfig } from '../types';

/**
 * A service to manage Azure-specific storage operations.
 */
export class AzureStorageService extends TokenStorageService {
    /**
     * The list of keys used to store credentials in the storage.
     */
    private credentialKeys = ['accountId', 'authId', 'identityId', 'identityToken', 'accessToken', 'hostKey', 'expiredTime'];

    constructor(readonly config: WebCoreConfig<'azure'>) {
        super(config);
    }

    /**
     * Retrieves all items from the storage.
     *
     * @returns An object containing all the stored items.
     */
    async getAllItems(): Promise<{ [key: string]: string }> {
        return await this.credentialKeys.reduce(async (promise, item) => {
            const result: { [key: string]: string } = await promise;
            result[`${this.prefix}.${item}`] = await this.storage.getItem(`${this.prefix}.${item}`);
            return Promise.resolve(result);
        }, Promise.resolve({}));
    }

    /**
     * Checks if there is a cached OAuth token in the storage.
     *
     * @returns A boolean indicating whether a cached token exists.
     */
    async hasCachedToken(): Promise<boolean> {
        const expiredTime = await this.storage.getItem(`${this.prefix}.expiredTime`);
        const identityToken = await this.storage.getItem(`${this.prefix}.identityToken`);
        const accessToken = await this.storage.getItem(`${this.prefix}.accessToken`);
        const hostKey = await this.storage.getItem(`${this.prefix}.hostKey`);

        return identityToken !== null && accessToken !== null && hostKey !== null && expiredTime !== null;
    }

    /**
     * Checks if the cached OAuth token needs to be refreshed.
     *
     * @returns A boolean indicating whether the token should be refreshed.
     */
    async shouldRefreshToken(): Promise<boolean> {
        const expiredTime = +(await this.storage.getItem(`${this.prefix}.expiredTime`));
        const now = new Date().getTime();
        return now >= expiredTime;
    }

    /**
     * Retrieves the cached OAuth token from the storage.
     *
     * @returns The cached OAuth token or `null` if not found.
     */
    async getCachedOAuthToken(): Promise<LemonOAuthToken | null> {
        const result: any = await this.credentialKeys.reduce(async (promise, item) => {
            const tmp: { [key: string]: string } = await promise;
            tmp[item] = await this.storage.getItem(`${this.prefix}.${item}`);
            return Promise.resolve(tmp);
        }, Promise.resolve({}));

        const HostKey = await this.storage.getItem(`${this.prefix}.hostKey`);
        result.credential = { HostKey };

        delete result.hostKey;
        delete result.expiredTime;

        return result as LemonOAuthToken | null;
    }

    /**
     * Saves the provided OAuth token to the storage.
     *
     * @param token The OAuth token to be saved.
     */
    async saveOAuthToken(token: LemonOAuthToken): Promise<void> {
        const { accountId, authId, credential, identityId, identityToken, accessToken } = token;
        const { hostKey } = credential;

        this.storage.setItem(`${this.prefix}.accountId`, accountId || '');
        this.storage.setItem(`${this.prefix}.authId`, authId || '');
        this.storage.setItem(`${this.prefix}.identityId`, identityId || '');
        this.storage.setItem(`${this.prefix}.identityToken`, identityToken || '');

        this.storage.setItem(`${this.prefix}.hostKey`, hostKey || '');
        this.storage.setItem(`${this.prefix}.accessToken`, accessToken || '');

        // Set the expiration time for the token.
        const TIME_DELAY = 0.5; // 0.5 = 30 minutes, 1 = 1 hour
        const expiredTime = new Date().getTime() + TIME_DELAY * 60 * 60 * 1000; // 30 minutes
        this.storage.setItem(`${this.prefix}.expiredTime`, expiredTime.toString());

        return;
    }

    /**
     * Clears all the cached OAuth tokens from the storage.
     */
    async clearOAuthToken(): Promise<void> {
        await Promise.all(this.credentialKeys.map(item => this.storage.removeItem(`${this.prefix}.${item}`)));
        return;
    }
}