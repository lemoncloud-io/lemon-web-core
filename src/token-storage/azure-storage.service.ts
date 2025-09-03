import { TokenStorageService } from './token-storage.service';
import { LemonOAuthToken, WebCoreConfig } from '../types';
import { convertCamelCaseFromSnake, getStorageKey, getStorageValue } from '../utils';

/**
 * A service to manage Azure-specific storage operations.
 */
export class AzureStorageService extends TokenStorageService {
    /**
     * The list of keys used to store credentials in the storage.
     */
    private credentialKeys = [
        'account_id',
        'auth_id',
        'identity_id',
        'identity_token',
        'access_token',
        'host_key',
        'expired_time',
        'issued_time',
        'client_id',
    ];

    /**
     * Gets the storage key (always snake_case).
     */
    private getKey(key: string): string {
        return getStorageKey(this.prefix, key);
    }

    /**
     * Gets a value from storage, checking both snake_case and camelCase formats for backward compatibility.
     */
    private async getStorageItem(key: string): Promise<string> {
        return (await getStorageValue(this.storage, this.prefix, key)) || '';
    }

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
            const key = this.getKey(item);
            const value = await this.getStorageItem(item);
            // Only include non-empty values
            if (value) {
                result[key] = value;
            }
            return Promise.resolve(result);
        }, Promise.resolve({}));
    }

    /**
     * Checks if there is a cached OAuth token in the storage.
     *
     * @returns A boolean indicating whether a cached token exists.
     */
    async hasCachedToken(): Promise<boolean> {
        const expiredTime = await this.getStorageItem('expired_time');
        const identityToken = await this.getStorageItem('identity_token');
        const accessToken = await this.getStorageItem('access_token');
        const hostKey = await this.getStorageItem('host_key');

        return !!identityToken && !!accessToken && !!hostKey && !!expiredTime;
    }

    /**
     * Checks if the cached OAuth token needs to be refreshed.
     *
     * @returns A boolean indicating whether the token should be refreshed.
     */
    async shouldRefreshToken(): Promise<boolean> {
        const expiredTime = +(await this.getStorageItem('expired_time'));
        const now = new Date().getTime();

        const noExpirationInfo = !expiredTime || expiredTime <= 0;
        const isExpired = now >= expiredTime;

        const needsRefresh = noExpirationInfo || isExpired;

        return needsRefresh;
    }

    /**
     * Retrieves the cached OAuth token from the storage.
     *
     * @returns The cached OAuth token or `null` if not found.
     */
    async getCachedOAuthToken(): Promise<LemonOAuthToken | null> {
        const result: any = await this.credentialKeys.reduce(async (promise, item) => {
            const tmp: { [key: string]: string } = await promise;
            tmp[convertCamelCaseFromSnake(item)] = await this.getStorageItem(item);
            return Promise.resolve(tmp);
        }, Promise.resolve({}));

        const hostKey = await this.getStorageItem('host_key');
        result.credential = { HostKey: hostKey };

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
        const { hostKey, clientId, Expiration } = credential;

        this.storage.setItem(this.getKey('account_id'), accountId || '');
        this.storage.setItem(this.getKey('auth_id'), authId || '');
        this.storage.setItem(this.getKey('identity_id'), identityId || '');
        this.storage.setItem(this.getKey('identity_token'), identityToken || '');

        this.storage.setItem(this.getKey('host_key'), hostKey || '');
        this.storage.setItem(this.getKey('access_token'), accessToken || '');
        this.storage.setItem(this.getKey('client_id'), clientId || 'default');

        const expiredTime = this.calculateTokenExpiration(Expiration, identityToken);
        this.storage.setItem(this.getKey('expired_time'), expiredTime.toString());

        const issuedTime = this.calculateTokenIssuedTime(identityToken);
        if (issuedTime) {
            this.storage.setItem(this.getKey('issued_time'), issuedTime.toString());
        }

        return;
    }

    /**
     * Clears all the cached OAuth tokens from the storage.
     */
    async clearOAuthToken(): Promise<void> {
        await Promise.all(this.credentialKeys.map(item => this.storage.removeItem(this.getKey(item))));
        return;
    }
}
