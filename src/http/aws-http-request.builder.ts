import axios, { AxiosHeaders, AxiosInstance, AxiosRequestConfig } from 'axios';
import { Body, Headers, HttpRequestData, HttpResponse, Params } from '../types';
import { AWSStorageService, REGION_KEY, USE_X_LEMON_IDENTITY_KEY, USE_X_LEMON_LANGUAGE_KEY } from '../token-storage';
import AWS from 'aws-sdk/global.js';
import { sigV4Client } from '../vendor';
import { isEmptyObject, LoggerService } from '../utils';

/**
 * Class to build and execute HTTP requests with AWS signing
 * @example
 * ```ts
 * const response: HttpResponse<OAuthResponse> = await new AWSHttpRequestBuilder({
 *     method: 'GET',
 *     baseURL: `https://api.lemoncloud.io/v1/oauth`,
 *  })
 *    .addHeaders({ Cookie: this.cookie })
 *    .setParams({ page: 0 })
 *    .execute();
 * ```
 */
export class AWSHttpRequestBuilder {
    private axiosInstance: AxiosInstance;
    private logger: LoggerService;
    private config: AxiosRequestConfig = {
        headers: {
            'Content-Type': 'application/json',
        },
        method: 'get',
    };

    /**
     * Creates an instance of AWSHttpRequestBuilder.
     * @param {AWSStorageService} tokenStorage - The AWS storage service for token management.
     * @param {AxiosRequestConfig} config - The Axios request configuration.
     * @param {AxiosInstance} axiosInstance - The Axios instance.
     * @throws {Error} If tokenStorage, method, or baseURL are not defined.
     */
    constructor(
        private readonly tokenStorage: AWSStorageService,
        config: AxiosRequestConfig,
        axiosInstance?: AxiosInstance
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
        this.axiosInstance = axiosInstance || axios.create(this.config);
        this.logger = new LoggerService('AWSHttpBuilder');
    }

    /**
     * Sets the request headers.
     * @param {Headers} headers - Headers to set.
     * @returns {AWSHttpRequestBuilder} - Returns the current instance to allow method chaining.
     */
    setHeaders(headers: Headers): AWSHttpRequestBuilder {
        this.config.headers = headers;
        return this;
    }

    /**
     * Sets the request parameters.
     * @param {Params} params - Parameters to set.
     * @returns {AWSHttpRequestBuilder} - Returns the current instance to allow method chaining.
     */
    setParams(params: Params): AWSHttpRequestBuilder {
        this.config.params = params;
        return this;
    }

    /**
     * Sets the request body.
     * @param {Body} data - Body data to set.
     * @returns {AWSHttpRequestBuilder} - Returns the current instance to allow method chaining.
     */
    setBody(data: Body): AWSHttpRequestBuilder {
        this.config.data = data;
        return this;
    }

    /**
     * Sets the request method.
     * @param {string} method - HTTP method to set.
     * @returns {AWSHttpRequestBuilder} - Returns the current instance to allow method chaining.
     */
    setMethod(method: string): AWSHttpRequestBuilder {
        this.config.method = method;
        return this;
    }

    /**
     * Adds additional headers to the request.
     * @param {Headers} headers - Headers to add.
     * @returns {AWSHttpRequestBuilder} - Returns the current instance to allow method chaining.
     */
    addHeaders(headers: Headers = {}): AWSHttpRequestBuilder {
        this.config.headers = { ...this.config.headers, ...headers };
        return this;
    }

    /**
     * Adds additional Axios request configuration.
     * @param {AxiosRequestConfig} config - The configuration to add.
     * @returns {AWSHttpRequestBuilder} - Returns the current instance to allow method chaining.
     */
    addAxiosRequestConfig(config: AxiosRequestConfig): AWSHttpRequestBuilder {
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
            const signedClient = await this.getSignedClient(this.config.baseURL);
            const data: HttpRequestData = {
                method: this.config.method?.toLowerCase() || 'get',
                params: this.config.params,
                body: this.config.data,
            };
            const sigendHeader = await this.getSignedHeader(signedClient, data);
            this.addHeaders(sigendHeader);
            return await this.axiosInstance.request<T>(this.config);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Gets the signed AWS client.
     * @private
     * @param {string} endpoint - The endpoint for the client.
     * @returns {Promise<any>} - The signed AWS client.
     * @throws {Error} If endpoint is not provided or signed client is not available.
     */
    private async getSignedClient(endpoint: string): Promise<any> {
        if (!endpoint) {
            throw new Error('@endpoint (string) is required!');
        }

        const region = await this.tokenStorage.getItem(REGION_KEY);
        const ok = AWS.config && AWS.config.credentials;
        const signedClient =
            ok &&
            sigV4Client.newClient({
                accessKey: AWS.config.credentials.accessKeyId,
                secretKey: AWS.config.credentials.secretAccessKey,
                sessionToken: AWS.config.credentials.sessionToken,
                region: region || 'ap-northeast-2',
                endpoint: endpoint,
                host: this.extractHostname(endpoint),
            });

        if (!signedClient) {
            this.logger.warn('signedClient is missing. Request without signing..');
        }
        return await signedClient;
    }

    /**
     * Gets the signed headers for the request.
     * @private
     * @param {any} signedClient - The signed AWS client.
     * @param {HttpRequestData} data - The request data.
     * @returns {Promise<any>} - The signed headers.
     */
    private async getSignedHeader(signedClient: any, data: HttpRequestData): Promise<any> {
        if (!signedClient) {
            return {};
        }

        const { method, path, params, body } = data;
        // check signRequest instance.
        const signedRequest = signedClient.signRequest({
            method: method,
            path: path || '',
            headers: {},
            queryParams: params || {},
            body: body || {},
        });
        const header = signedRequest && signedRequest.headers;

        const hasNoHeader = isEmptyObject(header);
        if (hasNoHeader) {
            this.logger.warn('signedClient is missing => Request without signing');
            return this.config.headers;
        }

        const headerWithIdentity = await this.addXLemonIdentityToHeader(header);
        return await this.addXLemonLanguageToHeader(headerWithIdentity);
    }

    /**
     * Adds x-lemon-identity to the header.
     * @param header The header to be added
     * @returns The header with x-lemon-identity added
     */
    private async addXLemonIdentityToHeader(header: any): Promise<AxiosHeaders> {
        const useXLemonIdentity = await this.tokenStorage.getItem(USE_X_LEMON_IDENTITY_KEY);
        if (!useXLemonIdentity || useXLemonIdentity === 'false') {
            return { ...header, ...this.config.headers };
        }
        const identityToken = await this.tokenStorage.getItem('identity_token');
        return {
            ...header,
            ...this.config.headers,
            'x-lemon-identity': identityToken,
        };
    }

    /**
     * Adds x-lemon-language to the header.
     * @param header The header to be added
     * @returns The header with x-lemon-language added
     */
    private async addXLemonLanguageToHeader(header: any): Promise<AxiosHeaders> {
        const [languageKey, language] = await Promise.all([
            this.tokenStorage.getItem(USE_X_LEMON_LANGUAGE_KEY),
            this.tokenStorage.getItem((await this.tokenStorage.getItem(USE_X_LEMON_LANGUAGE_KEY)) || ''),
        ]);

        return {
            ...header,
            ...this.config.headers,
            ...(languageKey && language && { 'x-lemon-language': language }),
        };
    }

    /**
     * Extracts the hostname from a URL.
     * @private
     * @param {string} url - The URL to extract the hostname from.
     * @returns {string} - The extracted hostname.
     */
    private extractHostname(url: string) {
        // refer: https://stackoverflow.com/a/23945027/5268806
        let hostname;
        // find & remove protocol (http, ftp, etc.) and get hostname
        if (url.indexOf('//') > -1) {
            hostname = url.split('/')[2];
        } else {
            hostname = url.split('/')[0];
        }
        // find & remove port number
        hostname = hostname.split(':')[0];
        // find & remove "?"
        hostname = hostname.split('?')[0];
        return hostname;
    }
}
