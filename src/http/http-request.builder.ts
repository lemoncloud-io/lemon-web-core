import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Body, Headers, HttpResponse, Params } from '../types';

/**
 * Class to build and execute HTTP requests
 * @example
 * ```ts
 * const response: HttpResponse<OAuthResponse> = await new HttpRequestBuilder({
 *     method: 'GET',
 *     baseURL: `https://api.lemoncloud.io/v1/oauth`,
 *  })
 *    .setHeaders({ Cookie: this.cookie })
 *    .setParams({ page: 0 })
 *    .execute();
 * ```
 */
export class HttpRequestBuilder {
    private axiosInstance: AxiosInstance;
    private config: AxiosRequestConfig = {
        headers: {
            'Content-Type': 'application/json',
        },
        method: 'get',
    };

    /**
     * @constructor
     * @param {AxiosRequestConfig} [config={}] - Initial configuration
     * @throws {Error} If the method is not defined
     * @throws {Error} If the baseURL is not defined
     */
    constructor(config: AxiosRequestConfig) {
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
     * Sets the request headers
     * @param {Headers} headers - Headers to set
     * @returns {HttpRequestBuilder} - Returns the current instance to allow method chaining
     */
    setHeaders(headers: Headers): HttpRequestBuilder {
        this.config.headers = headers;
        return this;
    }

    /**
     * Sets the request parameters
     * @param {Params} params - Parameters to set
     * @returns {HttpRequestBuilder} - Returns the current instance to allow method chaining
     */
    setParams(params: Params): HttpRequestBuilder {
        this.config.params = params;
        return this;
    }

    /**
     * Sets the request body
     * @param {Body} data - Body data to set
     * @returns {HttpRequestBuilder} - Returns the current instance to allow method chaining
     */
    setBody(data: Body): HttpRequestBuilder {
        this.config.data = data;
        return this;
    }

    /**
     * Sets the request method
     * @param {string} method - HTTP method to set
     * @returns {HttpRequestBuilder} - Returns the current instance to allow method chaining
     */
    setMethod(method: string): HttpRequestBuilder {
        this.config.method = method;
        return this;
    }

    /**
     * Adds additional headers to the request.
     * @param {Headers} headers - Headers to add.
     * @returns {HttpRequestBuilder} - Returns the current instance to allow method chaining.
     */
    addHeaders(headers: Headers = {}): HttpRequestBuilder {
        this.config.headers = { ...this.config.headers, ...headers };
        return this;
    }

    /**
     * Adds additional Axios request configuration.
     * @param {AxiosRequestConfig} config - The configuration to add.
     * @returns {HttpRequestBuilder} - Returns the current instance to allow method chaining.
     */
    addAxiosRequestConfig(config: AxiosRequestConfig): HttpRequestBuilder {
        this.config = { ...this.config, ...config };
        return this;
    }

    /**
     * Executes the HTTP request
     * @template T
     * @returns {Promise<HttpResponse<T>>} - Promise containing the response
     * @throws {Error} If an error occurs during the request
     */
    async execute<T>(): Promise<HttpResponse<T>> {
        try {
            return await this.axiosInstance.request<T>(this.config);
        } catch (error) {
            throw error;
        }
    }
}
