import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * @typedef {Object} Body - Represents the request body
 * @property {any} [key: string] - Arbitrary key-value pairs
 */
export declare type Body = {
    [key: string]: any;
};

/**
 * @typedef {Object} Headers - Represents the request headers
 * @property {any} [key: string] - Arbitrary key-value pairs
 */
export declare type Headers = {
    [key: string]: any;
};

/**
 * @typedef {Object} Params - Represents the request parameters
 * @property {any} [key: string] - Arbitrary key-value pairs
 */
export declare type Params = {
    [key: string]: any;
};

/**
 * Class to build and execute HTTP requests
 */
export class HttpRequestBuilder {
    private axiosInstance: AxiosInstance; // Axios instance
    private config: AxiosRequestConfig; // Axios request configuration

    /**
     * @constructor
     * @param {AxiosRequestConfig} [config={}] - Initial configuration
     * @throws {Error} If the method is not defined
     * @throws {Error} If the baseURL is not defined
     */
    constructor(config: AxiosRequestConfig = {}) {
        if (!config.method) {
            throw new Error('method should be defined!');
        }
        if (!config.baseURL) {
            throw new Error('baseURL should be defined!');
        }
        this.config = {
            ...config,
        };
        this.axiosInstance = axios.create(this.config); // Create Axios instance
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
     * Executes the HTTP request
     * @template T
     * @returns {Promise<AxiosResponse<T>>} - Promise containing the response
     * @throws {Error} If an error occurs during the request
     */
    async execute<T>(): Promise<AxiosResponse<T>> {
        try {
            return await this.axiosInstance.request<T>(this.config);
        } catch (error) {
            throw error;
        }
    }
}
