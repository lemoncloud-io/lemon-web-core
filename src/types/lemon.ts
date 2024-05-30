export interface LemonKMS {
    arn: string;
}

export interface LemonOAuthToken {
    accountId: string;
    authId: string;
    credential: LemonCredentials;
    identityId: string;
    identityToken: string;
    identityPoolId?: string;
    error?: any;
    accessToken?: string;
}

export interface LemonCredentials {
    AccessKeyId: string;
    SecretKey: string;
    Expiration?: string;
    SessionToken?: string;
    hostKey?: string;
}

export interface LemonRefreshToken {
    authId: string;
    accountId: string;
    identityId: string;
    credential: LemonCredentials;
}

export interface SignaturePayload {
    authId?: string;
    accountId?: string;
    identityId?: string;
    identityToken?: string;
}

export interface Storage {
    getItem(key: string, ...params: any): any;
    setItem(key: string, value: string, ...params: any): any;
    removeItem(key: string, ...params: any): any;
}
