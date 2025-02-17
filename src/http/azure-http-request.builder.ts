import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Body, Headers, HttpResponse, Params } from '../types';
import { AzureStorageService, USE_X_LEMON_IDENTITY_KEY, USE_X_LEMON_STORAGE_KEY } from '../token-storage';

/**
 * Class to build and execute HTTP requests with AWS signing
 * @example
 * ```ts
 * const response: HttpResponse<OAuthResponse> = await new AzureHttpRequestBuilder({
 *     method: 'GET',
 *     baseURL: `https://api.lemoncloud.io/v1/oauth`,
 *  })
 *    .addHeaders({ Cookie: this.cookie })
 *    .setParams({ page: 0 })
 *    .execute();
 * ```
 */
export class AzureHttpRequestBuilder {
    private axiosInstance: AxiosInstance;
    private config: AxiosRequestConfig = {
        headers: {
            'Content-Type': 'application/json',
        },
        method: 'get',
    };

    /**
     * Creates an instance of AWSHttpRequestBuilder.
     * @param {AzureStorageService} tokenStorage - The AWS storage service for token management.
     * @param {AxiosRequestConfig} config - The Axios request configuration.
     * @throws {Error} If tokenStorage, method, or baseURL are not defined.
     */
    constructor(
        private readonly tokenStorage: AzureStorageService,
        config: AxiosRequestConfig
    ) {
        if (!tokenStorage) {
            throw new Error('tokenStorage should be defined!');
        }
        if (!config.method) {
            throw new Error('method should be defined!');
        }
        if (!config.baseURL) {
            throw new Error('baseURL should be defined!');
        }
        this.config = { ...this.config, ...config };
        this.axiosInstance = axios.create(this.config);
    }

    /**
     * Sets the request headers.
     * @param {Headers} headers - Headers to set.
     * @returns {AWSHttpRequestBuilder} - Returns the current instance to allow method chaining.
     */
    setHeaders(headers: Headers): AzureHttpRequestBuilder {
        this.config.headers = headers;
        return this;
    }

    /**
     * Sets the request parameters.
     * @param {Params} params - Parameters to set.
     * @returns {AWSHttpRequestBuilder} - Returns the current instance to allow method chaining.
     */
    setParams(params: Params): AzureHttpRequestBuilder {
        this.config.params = params;
        return this;
    }

    /**
     * Sets the request body.
     * @param {Body} data - Body data to set.
     * @returns {AWSHttpRequestBuilder} - Returns the current instance to allow method chaining.
     */
    setBody(data: Body): AzureHttpRequestBuilder {
        this.config.data = data;
        return this;
    }

    /**
     * Sets the request method.
     * @param {string} method - HTTP method to set.
     * @returns {AWSHttpRequestBuilder} - Returns the current instance to allow method chaining.
     */
    setMethod(method: string): AzureHttpRequestBuilder {
        this.config.method = method;
        return this;
    }

    /**
     * Adds additional headers to the request.
     * @param {Headers} headers - Headers to add.
     * @returns {AWSHttpRequestBuilder} - Returns the current instance to allow method chaining.
     */
    addHeaders(headers: Headers = {}): AzureHttpRequestBuilder {
        this.config.headers = { ...this.config.headers, ...headers };
        return this;
    }

    /**
     * Adds additional Axios request configuration.
     * @param {AxiosRequestConfig} config - The configuration to add.
     * @returns {AWSHttpRequestBuilder} - Returns the current instance to allow method chaining.
     */
    addAxiosRequestConfig(config: AxiosRequestConfig): AzureHttpRequestBuilder {
        this.config = { ...this.config, ...config };
        return this;
    }

    /**
     * Executes the HTTP request.
     * @template T
     * @returns {Promise<HttpResponse<T>>} - Promise containing the response.
     * @throws {Error} If an error occurs during the request.
     */
    async execute<T>(): Promise<HttpResponse<T>> {
        try {
            await this.addCodeParams();
            await this.addBearerTokenToHeader();
            await this.addXLemonIdentityToHeader();
            await this.addXLemonLanguageToHeader();
            return await this.axiosInstance.request<T>(this.config);
        } catch (error) {
            throw error;
        }
    }
    /**
     * Adds code parameters to the request configuration.
     * Retrieves the `hostKey` and `clientId` from the token storage and sets them as request parameters.
     * @private
     * @async
     * @returns {Promise<void>} - A promise that resolves when the parameters are added.
     */
    private async addCodeParams(): Promise<void> {
        const code = (await this.tokenStorage.getItem('host_key')) || '';
        if (!code) {
            return;
        }
        const clientId = (await this.tokenStorage.getItem('client_id')) || 'default';
        const originParams = this.config.params || {};
        this.setParams({ ...originParams, code, clientId });
    }

    /**
     * Adds a Bearer token to the request headers.
     * Retrieves the `identityToken` from the token storage and sets it as the `Authorization` header.
     * @private
     * @async
     * @returns {Promise<void>} - A promise that resolves when the token is added.
     */
    private async addBearerTokenToHeader(): Promise<void> {
        const identityToken = (await this.tokenStorage.getItem('identity_token')) || '';
        if (!identityToken) {
            return;
        }
        this.addHeaders({ Authorization: `Bearer ${identityToken}` });
    }

    /**
     * Adds the x-lemon-identity token to the request headers if required.
     * Checks if the `USE_X_LEMON_IDENTITY_KEY` is set in the token storage and, if true,
     * retrieves the `identityToken` and sets it as the `x-lemon-identity` header.
     * @private
     * @async
     * @returns {Promise<void>} - A promise that resolves when the token is added.
     */
    private async addXLemonIdentityToHeader(): Promise<void> {
        const useXLemonIdentity = await this.tokenStorage.getItem(USE_X_LEMON_IDENTITY_KEY);
        if (!useXLemonIdentity || useXLemonIdentity === 'false') {
            return;
        }
        const identityToken = await this.tokenStorage.getItem('identity_token');
        this.addHeaders({ 'x-lemon-identity': identityToken });
    }

    /**
     * Adds the x-lemon-language header to the request if required.
     * First checks if a language key is set in storage, then retrieves the corresponding language value.
     * If both exist, adds the language as 'x-lemon-language' header.
     * @private
     * @async
     * @returns {Promise<void>} - A promise that resolves when the language header is added.
     */
    private async addXLemonLanguageToHeader(): Promise<void> {
        const languageKey = await this.tokenStorage.getItem(USE_X_LEMON_STORAGE_KEY);
        if (!languageKey) {
            return;
        }

        const language = await this.tokenStorage.getItem(languageKey);
        if (!language) {
            return;
        }

        this.addHeaders({ 'x-lemon-language': language });
    }
}
