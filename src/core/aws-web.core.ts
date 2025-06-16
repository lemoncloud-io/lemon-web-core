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
 * AWSWebCore class implements AWS-based operations for Lemoncloud authentication logic.
 * Provides comprehensive token management, credential building, and authenticated request capabilities.
 */
export class AWSWebCore implements WebCoreService {
    private readonly tokenStorage: AWSStorageService;
    private readonly logger: LoggerService;
    private sharedAxiosInstance: AxiosInstance;

    /**
     * Creates an instance of AWSWebCore with the specified configuration.
     * Initializes internal services including token storage, logging, and HTTP client.
     *
     * @param {WebCoreConfig<'aws'>} config - The AWS-specific configuration object containing
     *                                        OAuth endpoints, region settings, and other AWS parameters
     */
    constructor(private readonly config: WebCoreConfig<'aws'>) {
        this.logger = new LoggerService('AWSCore');
        this.tokenStorage = new AWSStorageService(this.config);
        this.sharedAxiosInstance = axios.create();
    }

    /**
     * Retrieves the shared Axios instance used for HTTP requests.
     * This instance is pre-configured and shared across all requests to maintain consistency.
     *
     * @returns {AxiosInstance} The configured Axios instance for making HTTP requests
     */
    getSharedAxiosInstance(): AxiosInstance {
        return this.sharedAxiosInstance;
    }

    /**
     * Initializes the AWS WebCore service by validating cached tokens and setting up credentials.
     * Performs token refresh if necessary or builds credentials from cached data.
     * This method should be called before using any authenticated operations.
     *
     * @returns {Promise<AWSWebCoreState>} A promise that resolves to the initialization state:
     *                                     - 'no-token': No valid token found
     *                                     - 'refreshed': Token was refreshed successfully
     *                                     - 'build': Credentials built from existing valid token
     * @throws {Error} Throws an error if token refresh fails or credentials cannot be built
     *
     * @example
     * ```typescript
     * const webCore = new AWSWebCore(config);
     * const state = await webCore.init();
     * if (state === 'no-token') {
     *   // Handle authentication required
     * }
     * ```
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
     * Retrieves the token storage service instance.
     * Provides access to the underlying storage service for advanced token management operations.
     *
     * @returns {AWSStorageService} The storage service that manages OAuth tokens and credentials
     */
    getTokenStorage(): AWSStorageService {
        return this.tokenStorage;
    }

    /**
     * Creates an HTTP request builder for unsigned requests.
     * Use this for requests that don't require AWS signature authentication.
     *
     * @param {AxiosRequestConfig} config - The Axios request configuration object containing
     *                                      method, URL, headers, and other request parameters
     * @returns {HttpRequestBuilder} A configured HTTP request builder instance
     *
     * @example
     * ```typescript
     * const builder = webCore.buildRequest({
     *   method: 'GET',
     *   url: '/api/public-endpoint'
     * });
     * const response = await builder.execute();
     * ```
     */
    buildRequest(config: AxiosRequestConfig): HttpRequestBuilder {
        return new HttpRequestBuilder(config, this.sharedAxiosInstance);
    }

    /**
     * Executes an HTTP request without AWS signature authentication.
     * Suitable for public endpoints or non-AWS services.
     *
     * @template T - The expected response data type
     * @param {string} method - The HTTP method (GET, POST, PUT, DELETE, etc.)
     * @param {string} url - The complete request URL or base URL
     * @param {Params} [params={}] - Query parameters to append to the URL
     * @param {Body} [body] - The request body for POST/PUT requests
     * @param {AxiosRequestConfig} [config] - Additional Axios configuration options
     * @returns {Promise<HttpResponse<T>>} Promise resolving to the HTTP response with typed data
     * @throws {Error} Throws on network errors, HTTP errors, or request configuration issues
     *
     * @example
     * ```typescript
     * const response = await webCore.request<UserData>(
     *   'GET',
     *   '/api/users/123',
     *   { include: 'profile' }
     * );
     * ```
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
     * Creates an HTTP request builder with AWS signature authentication.
     * Use this for requests to AWS services or signed API endpoints.
     *
     * @param {AxiosRequestConfig} config - The Axios request configuration object
     * @returns {AWSHttpRequestBuilder} A configured AWS HTTP request builder with signature capabilities
     *
     * @example
     * ```typescript
     * const builder = webCore.buildSignedRequest({
     *   method: 'POST',
     *   url: '/api/aws-protected-endpoint'
     * });
     * ```
     */
    buildSignedRequest(config: AxiosRequestConfig): AWSHttpRequestBuilder {
        return new AWSHttpRequestBuilder(this.tokenStorage, config, this.sharedAxiosInstance);
    }

    /**
     * Executes an HTTP request with AWS signature authentication.
     * Automatically signs the request using stored AWS credentials.
     *
     * @template T - The expected response data type
     * @param {string} method - The HTTP method (GET, POST, PUT, DELETE, etc.)
     * @param {string} url - The complete request URL or base URL
     * @param {Params} [params={}] - Query parameters to append to the URL
     * @param {Body} [body] - The request body for POST/PUT requests
     * @param {AxiosRequestConfig} [config] - Additional Axios configuration options
     * @returns {Promise<HttpResponse<T>>} Promise resolving to the signed HTTP response
     * @throws {Error} Throws on authentication errors, network errors, or signature failures
     *
     * @example
     * ```typescript
     * const response = await webCore.signedRequest<ApiResponse>(
     *   'POST',
     *   '/api/protected-resource',
     *   {},
     *   { data: 'sensitive information' }
     * );
     * ```
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
     * Retrieves all saved tokens from storage as a key-value map.
     * Useful for debugging, backup, or migration purposes.
     *
     * @returns {Promise<{ [key: string]: string }>} Promise resolving to an object containing
     *                                               all stored token data with keys and values
     */
    getSavedToken(): Promise<{ [key: string]: string }> {
        return this.tokenStorage.getAllItems();
    }

    /**
     * Checks if the user is currently authenticated with valid credentials.
     * Performs token validation and refresh if necessary before determining authentication status.
     *
     * @returns {Promise<boolean>} Promise resolving to true if authenticated with valid credentials,
     *                            false if no token exists or authentication fails
     * @throws {Error} Logs errors but doesn't throw, returning false on any authentication failure
     *
     * @example
     * ```typescript
     * if (await webCore.isAuthenticated()) {
     *   // User is authenticated, proceed with protected operations
     * } else {
     *   // Redirect to login or handle unauthenticated state
     * }
     * ```
     */
    async isAuthenticated(): Promise<boolean> {
        try {
            const hasCachedToken = await this.tokenStorage.hasCachedToken();
            if (!hasCachedToken) {
                return false;
            }

            const shouldRefreshToken = await this.tokenStorage.shouldRefreshToken();
            if (shouldRefreshToken) {
                this.logger.info('return isAuthenticated after refresh token');
                const refreshed = await this.refreshCachedToken();
                return refreshed !== null;
            }

            return new Promise(resolve => {
                try {
                    const credentials = AWS.config.credentials as AWS.Credentials;
                    if (!credentials) {
                        resolve(false);
                        return;
                    }

                    credentials.get(error => {
                        if (error) {
                            this.logger.error('get AWSConfig.credentials error: ', error);
                        }
                        resolve(!error);
                    });
                } catch (e) {
                    this.logger.error('isAuthenticated error: ', e);
                    resolve(false);
                }
            });
        } catch (error) {
            this.logger.error('isAuthenticated error:', error);
            return false;
        }
    }

    /**
     * Builds AWS credentials from an OAuth token and sets them in AWS.config.
     * Saves the token to storage and creates AWS credentials for subsequent API calls.
     *
     * @param {LemonOAuthToken} token - The OAuth token containing AWS credential information
     * @returns {Promise<AWS.Credentials>} Promise resolving to the built AWS credentials
     * @throws {Error} Throws if token is invalid or AWS credentials cannot be created
     *
     * @example
     * ```typescript
     * const credentials = await webCore.buildCredentialsByToken(oauthToken);
     * // AWS.config.credentials is now set and ready for use
     * ```
     */
    async buildCredentialsByToken(token: LemonOAuthToken): Promise<AWS.Credentials> {
        this.logger.log('buildCredentialsByToken()...');
        await this.buildAWSCredentialsByToken(token);

        const credentials = AWS.config.credentials as AWS.Credentials;
        if (!credentials) {
            throw new Error('Failed to build AWS credentials');
        }
        return credentials;
    }

    /**
     * Builds AWS credentials from cached storage data and sets them in AWS.config.
     * Uses previously stored credential information to recreate AWS credentials.
     *
     * @returns {Promise<AWS.Credentials>} Promise resolving to the built AWS credentials
     * @throws {Error} Throws if cached credentials are invalid or AWS credentials cannot be created
     *
     * @example
     * ```typescript
     * const credentials = await webCore.buildCredentialsByStorage();
     * // AWS.config.credentials is now set from cached data
     * ```
     */
    async buildCredentialsByStorage(): Promise<AWS.Credentials> {
        this.logger.log('buildCredentialsByStorage()...');
        await this.buildAWSCredentialsByStorage();

        const credentials = AWS.config.credentials as AWS.Credentials;
        if (!credentials) {
            throw new Error('Failed to build AWS credentials from storage');
        }
        return credentials;
    }

    /**
     * Saves KMS (Key Management Service) configuration to storage.
     * Stores KMS ARN and other encryption-related configuration for later use.
     *
     * @param {LemonKMS} kms - The KMS configuration object containing ARN and encryption settings
     * @returns {Promise<void>} Promise that resolves when KMS configuration is successfully saved
     * @throws {Error} Throws if KMS configuration cannot be saved to storage
     */
    async saveKMS(kms: LemonKMS): Promise<void> {
        this.logger.log('saveKMS()...');
        return await this.tokenStorage.saveKMS(kms);
    }

    /**
     * Refreshes the cached OAuth token by calling the refresh endpoint.
     * Obtains new credentials and updates AWS.config with fresh authentication data.
     *
     * @param {string} [domain=''] - Optional domain parameter for multi-tenant refresh requests
     * @param {string} [url=''] - Optional custom URL for the refresh endpoint, defaults to config.oAuthEndpoint
     * @returns {Promise<AWS.Credentials | null>} Promise resolving to new AWS credentials on success,
     *                                           null if refresh fails or token is invalid
     * @throws {Error} Logs errors but returns null instead of throwing
     *
     * @example
     * ```typescript
     * const newCredentials = await webCore.refreshCachedToken();
     * if (newCredentials) {
     *   // Token successfully refreshed
     * } else {
     *   // Refresh failed, user may need to re-authenticate
     * }
     * ```
     */
    async refreshCachedToken(domain: string = '', url: string = '') {
        try {
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

            const tokenData = response.data.Token || response.data;
            const refreshToken = {
                identityToken: tokenData.identityToken || cached.identityToken,
                identityPoolId: cached.identityPoolId,
                ...tokenData,
            };

            this.logger.info('success to refresh token');

            return await this.buildCredentialsByToken(refreshToken);
        } catch (error) {
            this.logger.error('token refresh failed:', error);
            return null;
        }
    }

    /**
     * Changes the user's active site and obtains new credentials for the target site.
     * Useful for multi-tenant applications where users can switch between different sites/organizations.
     *
     * @param {ChangeSiteBody} changeSiteBody - Object containing siteId and userId for the target site
     * @param {string} changeSiteBody.siteId - The identifier of the target site to switch to
     * @param {string} changeSiteBody.userId - The user identifier for the site change operation
     * @param {string} [url] - Optional custom URL for the site change endpoint
     * @returns {Promise<AWS.Credentials>} Promise resolving to new AWS credentials for the target site
     * @throws {Error} Throws if changeSiteBody is invalid, authId is missing, or site change fails
     *
     * @example
     * ```typescript
     * const credentials = await webCore.changeUserSite({
     *   siteId: 'new-site-123',
     *   userId: 'user-456'
     * });
     * // User is now authenticated for the new site
     * ```
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
     * Logs out the user by clearing AWS credentials and removing stored tokens.
     * Performs complete cleanup of authentication state.
     *
     * @returns {Promise<void>} Promise that resolves when logout is complete
     * @throws {Error} Throws if token cleanup fails
     *
     * @example
     * ```typescript
     * await webCore.logout();
     * // User is now logged out, all credentials cleared
     * ```
     */
    async logout(): Promise<void> {
        AWS.config.credentials = null;
        await this.tokenStorage.clearOAuthToken();
        return;
    }

    /**
     * Configures whether to use the X-Lemon-Identity header in requests.
     * Controls identity header inclusion for request identification and tracking.
     *
     * @param {boolean} use - True to include X-Lemon-Identity header, false to exclude it
     * @returns {Promise<void>} Promise that resolves when setting is saved
     */
    async setUseXLemonIdentity(use: boolean): Promise<void> {
        await this.tokenStorage.setItem(USE_X_LEMON_IDENTITY_KEY, `${use}`);
    }

    /**
     * Configures whether to use the X-Lemon-Language header with a specific key.
     * Controls language header inclusion for localization and language preference tracking.
     *
     * @param {boolean} use - True to include X-Lemon-Language header, false to exclude it
     * @param {string} [key] - The language key to use when use is true; required if use is true
     * @returns {Promise<void>} Promise that resolves when setting is saved
     *
     * @example
     * ```typescript
     * await webCore.setUseXLemonLanguage(true, 'en-US');
     * // X-Lemon-Language header will be included with 'en-US' value
     * ```
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
     * Generates a cryptographic signature for token-based operations.
     * Creates a time-based signature using stored token information for secure API calls.
     *
     * @returns {Promise<TokenSignature>} Promise resolving to signature object containing:
     *                                   - authId: Authentication identifier
     *                                   - current: Current timestamp in ISO format
     *                                   - signature: Calculated cryptographic signature
     *                                   - originToken: Original token data used for signature
     * @throws {Error} Throws if cached token is invalid or signature calculation fails
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
     * Retrieves current AWS credentials, refreshing them if necessary.
     * Checks token validity and performs refresh if the token is expired or near expiration.
     *
     * @returns {Promise<AWS.Credentials | null>} Promise resolving to current AWS credentials,
     *                                           or null if no valid token exists or refresh fails
     * @throws {Error} Logs errors but returns null instead of throwing
     *
     * @example
     * ```typescript
     * const credentials = await webCore.getCredentials();
     * if (credentials) {
     *   // Use credentials for AWS API calls
     * } else {
     *   // No valid credentials, authentication required
     * }
     * ```
     */
    async getCredentials(): Promise<AWS.Credentials | null> {
        const hasCachedToken = await this.tokenStorage.hasCachedToken();
        if (!hasCachedToken) {
            this.logger.info('has no cached token!');
            return null;
        }

        const shouldRefreshToken = await this.tokenStorage.shouldRefreshToken();
        if (shouldRefreshToken) {
            this.logger.info('should refresh token!');
            const refreshed = await this.refreshCachedToken();
            if (!refreshed) {
                return null;
            }
        }

        return await this.getCurrentCredentials();
    }

    /**
     * Builds AWS credentials from cached storage data.
     * Private method that creates AWS.Credentials object from stored credential data.
     *
     * @private
     * @returns {Promise<void>} Promise that resolves when credentials are built and set
     * @throws {Error} Throws if cached credentials are missing or invalid
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
     * Retrieves the current AWS credentials from AWS.config.
     * Private method that validates and returns the currently configured AWS credentials.
     *
     * @private
     * @returns {Promise<AWS.Credentials>} Promise resolving to current AWS credentials
     * @throws {Error} Throws if no credentials are configured or credential validation fails
     */
    private getCurrentCredentials(): Promise<AWS.Credentials> {
        return new Promise((resolve, reject) => {
            const credentials = AWS.config.credentials as AWS.Credentials;
            if (!credentials) {
                reject(new Error('No AWS credentials configured'));
                return;
            }

            credentials.get(error => {
                if (error) {
                    this.logger.error('Error on getCurrentCredentials: ', error);
                    reject(error);
                } else {
                    this.logger.info('success to get AWS credentials');
                    resolve(credentials);
                }
            });
        });
    }

    /**
     * Builds AWS credentials from an OAuth token and saves to storage.
     * Private method that processes token data, saves it to storage, and creates AWS credentials.
     *
     * @private
     * @param {LemonOAuthToken} token - The OAuth token containing credential information
     * @returns {Promise<void>} Promise that resolves when token is saved and credentials are created
     * @throws {Error} Throws if token is missing required fields or credential creation fails
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
     * Creates and sets AWS credentials in the global AWS configuration.
     * Private method that instantiates AWS.Credentials and assigns it to AWS.config.credentials.
     *
     * @private
     * @param {LemonCredentials} credentials - The credential object containing AWS access keys
     * @param {string} credentials.AccessKeyId - AWS access key identifier
     * @param {string} credentials.SecretKey - AWS secret access key
     * @param {string} [credentials.SessionToken] - Optional AWS session token for temporary credentials
     * @returns {void} No return value, sets AWS.config.credentials directly
     */
    private createAWSCredentials(credentials: LemonCredentials) {
        const { AccessKeyId, SecretKey, SessionToken } = credentials;
        AWS.config.credentials = new AWS.Credentials(AccessKeyId, SecretKey, SessionToken);
    }
}
