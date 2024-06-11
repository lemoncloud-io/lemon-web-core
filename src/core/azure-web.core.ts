import { AzureWebCoreState, Body, HttpResponse, LemonOAuthToken, Params, WebCoreConfig, WebCoreService } from '../types';
import { AzureStorageService, USE_X_LEMON_IDENTITY_KEY } from '../token-storage';
import { LoggerService } from '../utils';
import { AxiosRequestConfig } from 'axios';
import { AzureHttpRequestBuilder, HttpRequestBuilder } from '../http';

/**
 * Class to handle Azure-specific web core operations.
 * Implements the WebCoreService interface.
 */
export class AzureWebCore implements WebCoreService {
    private readonly tokenStorage: AzureStorageService;
    private readonly logger: LoggerService;

    /**
     * Creates an instance of AzureWebCore.
     * @param {WebCoreConfig<'azure'>} config - The configuration for the Azure web core.
     */
    constructor(private readonly config: WebCoreConfig<'azure'>) {
        this.logger = new LoggerService('AzureCore');
        this.tokenStorage = new AzureStorageService(this.config);
    }

    /**
     * Initializes the Azure web core by checking for cached tokens.
     * @returns {Promise<AzureWebCoreState>} - The state of the Azure web core after initialization.
     */
    async init(): Promise<AzureWebCoreState> {
        const hasCachedToken = await this.tokenStorage.hasCachedToken();
        if (!hasCachedToken) {
            this.logger.warn('initialized without token!');
            return 'no-token';
        }

        const shouldRefreshToken = await this.tokenStorage.shouldRefreshToken();
        if (shouldRefreshToken) {
            this.logger.info('initialized and refreshed token!');
            // TODO: refresh azure token
        }
        this.logger.info('initialized with token!');
        return 'has-token';
    }

    /**
     * Retrieves the token storage service.
     *
     * @returns {AzureStorageService} - The storage service that manages OAuth tokens.
     */
    getTokenStorage(): AzureStorageService {
        return this.tokenStorage;
    }

    /**
     * Builds a request using HttpRequestBuilder without Credentials.
     * @param {AxiosRequestConfig} config - The Axios request configuration.
     * @returns {HttpRequestBuilder} - The HttpRequestBuilder instance.
     */
    buildRequest(config: AxiosRequestConfig): HttpRequestBuilder {
        return new HttpRequestBuilder(config);
    }

    /**
     * Executes a HTTP request without Credentials.
     * @template T
     * @param {string} method - The HTTP method.
     * @param {string} url - The request URL.
     * @param {Params} [params={}] - The request parameters.
     * @param {Body} body - The request body.
     * @param {AxiosRequestConfig} [config] - Additional Axios request configuration.
     * @returns {Promise<HttpResponse<T>>} - The Axios response.
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
     * Builds a signed request using the provided Axios configuration.
     * @param {AxiosRequestConfig} config - The Axios request configuration.
     * @returns {AzureHttpRequestBuilder} - The request builder for the signed request.
     */
    buildSignedRequest(config: AxiosRequestConfig): AzureHttpRequestBuilder {
        return new AzureHttpRequestBuilder(this.tokenStorage, config);
    }

    /**
     * Executes a signed HTTP request.
     * @template T
     * @param {string} method - The HTTP method to use for the request.
     * @param {string} url - The URL for the request.
     * @param {Params} [params={}] - The URL parameters for the request.
     * @param {Body} [body] - The request body.
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
        const builder = new AzureHttpRequestBuilder(this.tokenStorage, {
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
     * Retrieves all saved tokens from the storage.
     * @returns {Promise<{ [key: string]: string }>} - An object containing all saved tokens.
     */
    getSavedToken(): Promise<{ [key: string]: string }> {
        return this.tokenStorage.getAllItems();
    }

    /**
     * Checks if the user is authenticated.
     * @returns {Promise<boolean>} - True if authenticated, otherwise false.
     */
    async isAuthenticated(): Promise<boolean> {
        const hasCachedToken = await this.tokenStorage.hasCachedToken();
        if (!hasCachedToken) {
            return false;
        }

        const shouldRefreshToken = await this.tokenStorage.shouldRefreshToken();
        if (shouldRefreshToken) {
            this.logger.info('should refresh token!');
            // TODO: refresh azure token
            return true;
        }
        return true;
    }

    /**
     * Saves an OAuth token to the storage.
     * @param {LemonOAuthToken} token - The OAuth token to save.
     * @returns {Promise<void>} - A promise that resolves when the token is saved.
     */
    async saveOAuthToken(token: LemonOAuthToken): Promise<void> {
        return await this.tokenStorage.saveOAuthToken(token);
    }

    /**
     * Logs the user out by clearing the OAuth token from the storage.
     * @returns {Promise<void>} - A promise that resolves when the user is logged out.
     */
    async logout(): Promise<void> {
        await this.tokenStorage.clearOAuthToken();
        return;
    }

    /**
     * Sets whether to use the x-lemon-identity header.
     * @param {boolean} use - True to use the x-lemon-identity header, otherwise false.
     * @returns {Promise<void>} - A promise that resolves when the setting is updated.
     */
    async setUseXLemonIdentity(use: boolean): Promise<void> {
        await this.tokenStorage.setItem(USE_X_LEMON_IDENTITY_KEY, `${use}`);
    }
}
