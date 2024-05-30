import { Body, LemonCredentials, LemonKMS, LemonOAuthToken, Params, WebCoreConfig, WebCoreService } from '../types';
import { AWSStorageService, USE_X_LEMON_IDENTITY_KEY } from '../token-storage';
import { calcSignature, LoggerService } from '../utils';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { AWSHttpRequestBuilder } from '../http';
import * as AWS from 'aws-sdk/global.js';

/**
 * AWSWebCore class implements AWS-based operations for Lemoncloud authentication logic
 */
export class AWSWebCore implements WebCoreService {
    private readonly tokenStorage: AWSStorageService;
    private readonly logger: LoggerService;

    /**
     * Creates an instance of AWSWebCore.
     * @param {WebCoreConfig<'aws'>} config - The configuration for the AWS WebCore.
     */
    constructor(private readonly config: WebCoreConfig<'aws'>) {
        this.logger = new LoggerService('AWSCore');
        this.tokenStorage = new AWSStorageService(this.config);
    }

    /**
     * Builds a signed request using AWSHttpRequestBuilder.
     * @param {AxiosRequestConfig} config - The Axios request configuration.
     * @returns {AWSHttpRequestBuilder} - The AWSHttpRequestBuilder instance.
     */
    buildSignedRequest(config: AxiosRequestConfig): AWSHttpRequestBuilder {
        return new AWSHttpRequestBuilder(this.tokenStorage, config);
    }

    /**
     * Executes a signed HTTP request.
     * @template T
     * @param {string} method - The HTTP method.
     * @param {string} url - The request URL.
     * @param {Params} [params={}] - The request parameters.
     * @param {Body} body - The request body.
     * @param {AxiosRequestConfig} [config] - Additional Axios request configuration.
     * @returns {Promise<AxiosResponse<T>>} - The Axios response.
     */
    async signedRequest<T>(
        method: string,
        url: string,
        params: Params = {},
        body: Body,
        config?: AxiosRequestConfig
    ): Promise<AxiosResponse<T>> {
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
            (<AWS.Credentials>AWS.config.credentials).get(error => {
                if (error) {
                    this.logger.error('get AWSConfig.credentials error: ', error);
                }
                const isAuthenticated = !error;
                resolve(isAuthenticated);
            });
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
        await this.buildAWSCredentialsByStorage();
        return await this.getCredentials();
    }

    /**
     * Saves the KMS (Key Management Service) details to storage.
     * @param {LemonKMS} kms - The KMS details.
     * @returns {Promise<void>} - A promise that resolves when the KMS details are saved.
     */
    async saveKMS(kms: LemonKMS): Promise<void> {
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
        const payload = {
            authId: cached.authId,
            accountId: cached.accountId,
            identityId: cached.identityId,
            identityToken: cached.identityToken,
        };
        const current = new Date().toISOString();
        const signature = calcSignature(payload, current);

        const response: AxiosResponse<LemonOAuthToken> = await this.signedRequest(
            'POST',
            url ? url : `${this.config.oAuthEndpoint}/oauth/${cached.authId}/refresh`,
            {},
            { current, signature, domain }
        );
        const refreshToken = {
            ...response.data,
            identityPoolId: cached.identityPoolId,
        };
        this.logger.info('refreshToken', refreshToken);
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
     * Builds AWS credentials using the cached credentials from storage.
     * @returns {Promise<void>} - A promise that resolves when the credentials are built.
     */
    async buildAWSCredentialsByStorage(): Promise<void> {
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
            return this.getCurrentCredentials();
        }

        return null;
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
