import {
    AWSWebCoreState,
    Body,
    ChangeSiteBody,
    HttpResponse,
    LemonCredentials,
    LemonKMS,
    LemonOAuthToken,
    Params,
    RefreshTokenBody,
    TokenSignature,
    WebCoreConfig,
    WebCoreService,
} from '../types';
import { AWSStorageService, USE_X_LEMON_IDENTITY_KEY, USE_X_LEMON_LANGUAGE_KEY } from '../token-storage';
import { calcSignature, LoggerService } from '../utils';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { AWSHttpRequestBuilder, HttpRequestBuilder } from '../http';
import AWS from 'aws-sdk/global.js';

/**
 * AWSWebCore class implements AWS-based operations for Lemoncloud authentication logic
 */
export class AWSWebCore implements WebCoreService {
    private readonly tokenStorage: AWSStorageService;
    private readonly logger: LoggerService;
    private sharedAxiosInstance: AxiosInstance;

    /**
     * Creates an instance of AWSWebCore.
     * @param {WebCoreConfig<'aws'>} config - The configuration for the AWS WebCore.
     */
    constructor(private readonly config: WebCoreConfig<'aws'>) {
        this.logger = new LoggerService('AWSCore');
        this.tokenStorage = new AWSStorageService(this.config);
        this.sharedAxiosInstance = axios.create();
    }

    /**
     * Gets the shared axios instance
     * @returns The shared axios instance
     */
    getSharedAxiosInstance(): AxiosInstance {
        return this.sharedAxiosInstance;
    }

    /**
     * Checks if there is a cached token and refreshes it if needed.
     * If the token should be refreshed, it refreshes the token and updates the AWS credentials.
     * If the token is still valid, it uses the cached credentials to build AWS credentials.
     *
     * @returns {Promise<AWSWebCoreState>} - A promise that resolves to a string indicating the action taken.
     * @throws {Error} - Throws an error if there is no cached token.
     */
    async init(): Promise<AWSWebCoreState> {
        await this.tokenStorage.initLemonConfig();
        const hasCachedToken = await this.tokenStorage.hasCachedToken();
        if (!hasCachedToken) {
            this.logger.warn('initialized without token!');
            return 'no-token';
        }

        const shouldRefreshToken = await this.tokenStorage.shouldRefreshToken();
        if (shouldRefreshToken) {
            const refreshed = await this.refreshCachedToken();
            if (refreshed) {
                await this.getCurrentCredentials();
                this.logger.info('initialized and refreshed token!');
                return 'refreshed';
            }
        }

        const cachedToken = await this.tokenStorage.hasCachedToken();
        if (!cachedToken) {
            this.logger.warn('initialized without token!');
            return 'no-token';
        }

        // build AWS credential without refresh
        const credential = await this.tokenStorage.getCachedCredentials();
        this.createAWSCredentials(credential);
        this.logger.info('initialized with token!');
        return 'build';
    }

    /**
     * Retrieves the token storage service.
     *
     * @returns {AWSStorageService} - The storage service that manages OAuth tokens.
     */
    getTokenStorage(): AWSStorageService {
        return this.tokenStorage;
    }

    /**
     * Builds a request using HttpRequestBuilder without Credentials.
     * @param {AxiosRequestConfig} config - The Axios request configuration.
     * @returns {HttpRequestBuilder} - The HttpRequestBuilder instance.
     */
    buildRequest(config: AxiosRequestConfig): HttpRequestBuilder {
        return new HttpRequestBuilder(config, this.sharedAxiosInstance);
    }

    /**
     * Executes a HTTP request without Credentials.
     * @template T
     * @param {string} method - The HTTP method.
     * @param {string} url - The request URL.
     * @param {Params} [params={}] - The request parameters.
     * @param {Body} body - The request body.
     * @param {AxiosRequestConfig} [config] - Additional Axios request configuration.
     * @returns {Promise<Response<T>>} - The Axios response.
     */
    async request<T>(method: string, url: string, params: Params = {}, body?: Body, config?: AxiosRequestConfig): Promise<HttpResponse<T>> {
        const builder = new HttpRequestBuilder({
            method,
            baseURL: url,
            params,
        });
        if (body) {
            builder.setBody(body);
        }
        if (config) {
            builder.addAxiosRequestConfig(config);
        }
        return await builder.execute();
    }

    /**
     * Builds a signed request using AWSHttpRequestBuilder.
     * @param {AxiosRequestConfig} config - The Axios request configuration.
     * @returns {AWSHttpRequestBuilder} - The AWSHttpRequestBuilder instance.
     */
    buildSignedRequest(config: AxiosRequestConfig): AWSHttpRequestBuilder {
        return new AWSHttpRequestBuilder(this.tokenStorage, config, this.sharedAxiosInstance);
    }

    /**
     * Executes a signed HTTP request.
     * @template T
     * @param {string} method - The HTTP method.
     * @param {string} url - The request URL.
     * @param {Params} [params={}] - The request parameters.
     * @param {Body} body - The request body.
     * @param {AxiosRequestConfig} [config] - Additional Axios request configuration.
     * @returns {Promise<HttpResponse<T>>} - The Axios response.
     */
    async signedRequest<T>(
        method: string,
        url: string,
        params: Params = {},
        body?: Body,
        config?: AxiosRequestConfig
    ): Promise<HttpResponse<T>> {
        const builder = new AWSHttpRequestBuilder(this.tokenStorage, {
            method,
            baseURL: url,
            params,
        });
        if (body) {
            builder.setBody(body);
        }
        if (config) {
            builder.addAxiosRequestConfig(config);
        }
        return await builder.execute();
    }

    /**
     * Retrieves the saved tokens from the storage.
     * @returns {Promise<{ [key: string]: string }>} - The saved tokens.
     */
    getSavedToken(): Promise<{ [key: string]: string }> {
        return this.tokenStorage.getAllItems();
    }

    /**
     * Checks if the user is authenticated.
     * @returns {Promise<boolean>} - True if authenticated, false otherwise.
     */
    async isAuthenticated(): Promise<boolean> {
        const hasCachedToken = await this.tokenStorage.hasCachedToken();
        if (!hasCachedToken) {
            return false;
        }

        const shouldRefreshToken = await this.tokenStorage.shouldRefreshToken();
        if (shouldRefreshToken) {
            this.logger.info('return isAuthenticated after refresh token');
            const refreshed = await this.refreshCachedToken();
            if (refreshed) {
                return true;
            }
        }

        const cachedToken = await this.tokenStorage.hasCachedToken();
        if (!cachedToken) {
            return false;
        }

        return new Promise(resolve => {
            try {
                (<AWS.Credentials>AWS.config.credentials).get(error => {
                    if (error) {
                        this.logger.error('get AWSConfig.credentials error: ', error);
                    }
                    const isAuthenticated = !error;
                    resolve(isAuthenticated);
                });
            } catch (e) {
                this.logger.error('isAuthenticated error: ', e);
            }
        });
    }

    /**
     * Builds AWS credentials using an OAuth token.
     * @param {LemonOAuthToken} token - The OAuth token.
     * @returns {Promise<AWS.Credentials>} - The AWS credentials.
     */
    async buildCredentialsByToken(token: LemonOAuthToken): Promise<AWS.Credentials> {
        this.logger.log('buildCredentialsByToken()...');
        await this.buildAWSCredentialsByToken(token);
        return await this.getCredentials();
    }

    /**
     * Builds AWS credentials using the cached credentials from storage.
     * @returns {Promise<AWS.Credentials>} - The AWS credentials.
     */
    async buildCredentialsByStorage(): Promise<AWS.Credentials> {
        this.logger.log('buildCredentialsByStorage()...');
        await this.buildAWSCredentialsByStorage();
        return await this.getCredentials();
    }

    /**
     * Saves the KMS (Key Management Service) details to storage.
     * @param {LemonKMS} kms - The KMS details.
     * @returns {Promise<void>} - A promise that resolves when the KMS details are saved.
     */
    async saveKMS(kms: LemonKMS): Promise<void> {
        this.logger.log('saveKMS()...');
        return await this.tokenStorage.saveKMS(kms);
    }

    /**
     * Refreshes the cached token.
     * @param {string} [domain=''] - The domain for the refresh request.
     * @param {string} [url=''] - The request url for refresh token
     * @returns {Promise<AWS.Credentials | null>} - The AWS credentials or null if refresh fails.
     */
    async refreshCachedToken(domain: string = '', url: string = '') {
        const cached = await this.tokenStorage.getCachedOAuthToken();
        if (!cached.authId) {
            throw new Error('authId is required for token refresh');
        }

        const payload = {
            authId: cached.authId,
            accountId: cached.accountId,
            identityId: cached.identityId,
            identityToken: cached.identityToken,
        };
        const current = new Date().toISOString();
        const signature = calcSignature(payload, current);

        let body: RefreshTokenBody = { current, signature };
        if (domain && domain.length > 0) {
            body = { ...body, domain };
        }

        const response: HttpResponse<LemonOAuthToken> = await this.signedRequest(
            'POST',
            url ? url : `${this.config.oAuthEndpoint}/oauth/${cached.authId}/refresh`,
            {},
            { ...body }
        );
        const refreshToken = {
            identityToken: response.data.identityToken || cached.identityToken,
            identityPoolId: cached.identityPoolId,
            ...(response.data.Token ? response.data.Token : response.data),
        };
        this.logger.info('success to refresh token');
        return await this.buildCredentialsByToken(refreshToken);
    }

    /**
     * Refreshes the cached token new version
     * @param {string} [domain=''] - The domain for the refresh request.
     * @param {string} [url=''] - The request url for refresh token
     * @returns {Promise<AWS.Credentials | null>} - The AWS credentials or null if refresh fails.
     */
    async refreshCachedTokenV2(domain: string = '', url: string = '') {
        const cached = await this.tokenStorage.getCachedOAuthToken();
        if (!cached.authId) {
            throw new Error('authId is required for token refresh');
        }

        const payload = {
            authId: cached.authId,
            accountId: cached.accountId,
            identityId: cached.identityId,
            identityToken: cached.identityToken,
        };
        const current = new Date().toISOString();
        const signature = calcSignature(payload, current);

        let body: RefreshTokenBody = { current, signature };
        if (domain && domain.length > 0) {
            body = { ...body, domain };
        }

        const response: HttpResponse<any> = await this.signedRequest(
            'POST',
            url ? url : `${this.config.oAuthEndpoint}/oauth/${cached.authId}/refresh`,
            {},
            { ...body }
        );
        const refreshToken = {
            ...(response.data.Token ? response.data.Token : response.data),
            identityToken: response.data.identityToken || cached.identityToken,
            identityPoolId: cached.identityPoolId,
        };
        this.logger.info('success to refresh token');
        return await this.buildCredentialsByToken(refreshToken);
    }

    /**
     * Changes the user site and returns new AWS credentials.
     *
     * @param {ChangeSiteBody} changeSiteBody - The body containing site change details.
     * @param {string} [url] - Optional URL for the OAuth endpoint.
     * @returns {Promise<AWS.Credentials>} - A promise that resolves to AWS credentials.
     * @throws Will throw an error if `changeSiteBody`, `changeSiteBody.siteId`, or `changeSiteBody.userId` are not provided.
     *
     * @example
     * const changeSiteBody = { siteId: 'newSiteId', userId: 'userId123' };
     * const credentials = await changeUserSite(changeSiteBody);
     */
    async changeUserSite(changeSiteBody: ChangeSiteBody, url?: string): Promise<AWS.Credentials> {
        if (!changeSiteBody || !changeSiteBody.siteId || !changeSiteBody.userId) {
            throw new Error('@changeSiteBody required');
        }

        const cached = await this.tokenStorage.getCachedOAuthToken();
        const target = `${changeSiteBody.userId}@${changeSiteBody.siteId}`;
        const tokenSignature = await this.getTokenSignature();
        const { authId, current, signature, originToken } = tokenSignature;
        if (!authId) {
            throw new Error('authId is required for token refresh');
        }

        const response: HttpResponse<LemonOAuthToken> = await this.signedRequest(
            'POST',
            url ? url : `${this.config.oAuthEndpoint}/oauth/${authId}/refresh`,
            {},
            { current, signature, target }
        );
        const refreshToken = {
            ...response.data,
            identityToken: response.data?.identityToken || originToken.identityToken,
            identityPoolId: cached.identityPoolId,
        };
        this.logger.info('success to change user site');
        return await this.buildCredentialsByToken(refreshToken);
    }

    /**
     * Logs out the user.
     * @returns {Promise<boolean>} - A promise that resolves to false.
     */
    async logout(): Promise<void> {
        AWS.config.credentials = null;
        await this.tokenStorage.clearOAuthToken();
        return;
    }

    /**
     * Sets the use of X-Lemon-Identity header.
     * @param {boolean} use - Whether to use the X-Lemon-Identity header.
     */
    async setUseXLemonIdentity(use: boolean): Promise<void> {
        await this.tokenStorage.setItem(USE_X_LEMON_IDENTITY_KEY, `${use}`);
    }

    /**
     * Sets whether to use the X-Lemon-Language header with a specific key.
     * @param {boolean} use - Whether to use the X-Lemon-Language header.
     * @param {string} key? - The storage key to set.
     */
    async setUseXLemonLanguage(use: boolean, key?: string): Promise<void> {
        if (!use) {
            await this.tokenStorage.setItem(USE_X_LEMON_LANGUAGE_KEY, '');
            return;
        }
        if (!key) {
            return;
        }
        await this.tokenStorage.setItem(USE_X_LEMON_LANGUAGE_KEY, key);
    }

    /**
     * Asynchronously retrieves the token signature.
     * @returns {Promise<TokenSignature>} - A promise that resolves to a TokenSignature object.
     */
    async getTokenSignature(): Promise<TokenSignature> {
        const originToken = await this.tokenStorage.getCachedOAuthToken();
        const payload = {
            authId: originToken.authId,
            accountId: originToken.accountId,
            identityId: originToken.identityId,
            identityToken: originToken.identityToken,
        };
        const current = new Date().toISOString();
        const signature = calcSignature(payload, current);
        return { authId: payload.authId, current, signature, originToken };
    }

    /**
     * Retrieves the AWS credentials.
     * @returns {Promise<AWS.Credentials | null>} - The AWS credentials or null if no cached token exists.
     */
    async getCredentials(): Promise<AWS.Credentials | null> {
        const hasCachedToken = await this.tokenStorage.hasCachedToken();
        if (!hasCachedToken) {
            this.logger.info('has no cached token!');
            return new Promise(resolve => resolve(null));
        }

        const shouldRefreshToken = await this.tokenStorage.shouldRefreshToken();
        if (shouldRefreshToken) {
            this.logger.info('should refresh token!');
            const refreshed = await this.refreshCachedToken();
            if (refreshed) {
                return await this.getCurrentCredentials();
            }
        }

        const cachedToken = await this.tokenStorage.hasCachedToken();
        if (!cachedToken) {
            this.logger.info('has no cached token!');
            return new Promise(resolve => resolve(null));
        }

        const credentials = AWS.config.credentials as AWS.Credentials;
        const shouldRefresh = credentials.needsRefresh();
        if (shouldRefresh) {
            await credentials.refreshPromise();
            return await this.getCurrentCredentials();
        }

        return await this.getCurrentCredentials();
    }

    /**
     * Builds AWS credentials using the cached credentials from storage.
     * @returns {Promise<void>} - A promise that resolves when the credentials are built.
     */
    private async buildAWSCredentialsByStorage(): Promise<void> {
        this.logger.log('buildAWSCredentialsByStorage()...');
        const credentials = await this.tokenStorage.getCachedCredentials();

        const { AccessKeyId, SecretKey } = credentials;
        if (!AccessKeyId) {
            throw new Error('.AccessKeyId (string) is required!');
        }
        if (!SecretKey) {
            throw new Error('.SecretKey (string) is required!');
        }
        this.createAWSCredentials(credentials);
    }

    /**
     * Retrieves the current AWS credentials.
     * @private
     * @returns {Promise<AWS.Credentials>} - The AWS credentials.
     */
    private getCurrentCredentials(): Promise<AWS.Credentials> {
        return new Promise((resolve, reject) => {
            const credentials = AWS.config.credentials as AWS.Credentials;

            credentials?.get(error => {
                if (error) {
                    this.logger.error('Error on getCurrentCredentials: ', error);
                    reject(null);
                }
                this.logger.info('success to get AWS credentials');
                const awsCredentials = AWS.config.credentials as AWS.Credentials;
                resolve(awsCredentials);
            });
        });
    }

    /**
     * Retrieves the current AWS credentials.
     * @private
     * @returns {Promise<AWS.Credentials>} - The AWS credentials.
     */
    private async buildAWSCredentialsByToken(token: LemonOAuthToken): Promise<void> {
        const { credential } = token;
        const { AccessKeyId, SecretKey } = credential;
        if (!AccessKeyId) {
            throw new Error('.AccessKeyId (string) is required!');
        }
        if (!SecretKey) {
            throw new Error('.SecretKey (string) is required!');
        }
        await this.tokenStorage.saveOAuthToken(token);
        return this.createAWSCredentials(credential);
    }

    /**
     * Builds AWS credentials using an OAuth token.
     * @private
     * @returns {Promise<void>} - A promise that resolves when the credentials are built.
     * @param credentials
     */
    private createAWSCredentials(credentials: LemonCredentials) {
        const { AccessKeyId, SecretKey, SessionToken } = credentials;
        AWS.config.credentials = new AWS.Credentials(AccessKeyId, SecretKey, SessionToken);
    }
}
