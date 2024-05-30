export declare type Body = {
    [key: string]: any;
};

export declare type Headers = {
    [key: string]: any;
};

export declare type Params = {
    [key: string]: any;
};

export interface AWSHttpRequestData {
    method: string;
    path?: string;
    params?: Params;
    body?: Body;
}
