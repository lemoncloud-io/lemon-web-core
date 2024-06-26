/**
 * Represents the body of an HTTP request, which can contain any key-value pairs.
 */
export declare type Body = {
    [key: string]: any;
};

/**
 * Represents the headers of an HTTP request, which can contain any key-value pairs.
 */
export declare type Headers = {
    [key: string]: any;
};

/**
 * Represents the query parameters of an HTTP request, which can contain any key-value pairs.
 */
export declare type Params = {
    [key: string]: any;
};

/**
 * Defines the structure of an HTTP request.
 */
export interface HttpRequestData {
    /**
     * The HTTP method (e.g., GET, POST, PUT, etc.).
     */
    method: string;

    /**
     * The path of the request URL.
     */
    path?: string;

    /**
     * The query parameters of the request.
     */
    params?: Params;

    /**
     * The request body.
     */
    body?: Body;
}

export interface HttpResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers?: any;
    config?: any;
    request?: any;
}
