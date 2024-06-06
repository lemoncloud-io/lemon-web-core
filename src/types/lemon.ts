/**
 * Represents the state of the AWS Web Core service.
 */
export type AWSWebCoreState = 'no-token' | 'refreshed' | 'build';

/**
 * Represents the state of the Azure Web Core service.
 */
export type AzureWebCoreState = 'no-token' | 'has-token';

/**
 * Represents the ARN of a KMS key in AWS.
 */
export interface LemonKMS {
    arn: string;
}

/**
 * Represents an OAuth token returned by Lemon.
 */
export interface LemonOAuthToken {
    /**
     * The account ID associated with the token.
     */
    accountId: string;
    /**
     * The authentication ID associated with the token.
     */
    authId: string;
    /**
     * The credentials associated with the token.
     */
    credential: LemonCredentials;
    /**
     * The identity ID associated with the token.
     */
    identityId: string;
    /**
     * The identity token associated with the token.
     */
    identityToken: string;
    /**
     * The identity pool ID associated with the token (optional).
     */
    identityPoolId?: string;
    /**
     * Any error information associated with the token (optional).
     */
    error?: any;
    /**
     * The access token associated with the token (optional).
     */
    accessToken?: string;
}

/**
 * Represents the credentials associated with an OAuth token.
 */
export interface LemonCredentials {
    /**
     * The Access Key ID.
     */
    AccessKeyId: string;
    /**
     * The Secret Key.
     */
    SecretKey: string;
    /**
     * The expiration time of the credentials (optional).
     */
    Expiration?: string;
    /**
     * The session token associated with the credentials (optional).
     */
    SessionToken?: string;
    /**
     * The host key associated with the credentials for Azure (optional).
     */
    hostKey?: string;
    /**
     * The client id for Azure (optional).
     */
    clientId?: string;
}

/**
 * Interface representing a Lemon refresh token.
 */
export interface LemonRefreshToken {
    /**
     * The authentication ID associated with the refresh token.
     */
    authId: string;

    /**
     * The account ID associated with the refresh token.
     */
    accountId: string;

    /**
     * The identity ID associated with the refresh token.
     */
    identityId: string;

    /**
     * The credentials associated with the refresh token.
     */
    credential: LemonCredentials;
}

/**
 * The payload used for signature generation.
 */
export interface SignaturePayload {
    /**
     * The authentication ID.
     */
    authId?: string;
    /**
     * The account ID.
     */
    accountId?: string;
    /**
     * The identity ID.
     */
    identityId?: string;
    /**
     * The identity token.
     */
    identityToken?: string;
}

/**
 * Interface for storage operations.
 */
export interface Storage {
    /**
     * Get the value associated with the given key.
     *
     * @param key The key to retrieve the value for.
     * @param params Additional parameters for the operation.
     * @returns The value associated with the given key.
     */
    getItem(key: string, ...params: any): any;

    /**
     * Set the value for the given key.
     *
     * @param key The key to set the value for.
     * @param value The value to be stored.
     * @param params Additional parameters for the operation.
     */
    setItem(key: string, value: string, ...params: any): any;

    /**
     * Remove the value associated with the given key.
     *
     * @param key The key to remove the value for.
     * @param params Additional parameters for the operation.
     */
    removeItem(key: string, ...params: any): any;
}

/**
 * The token signature object.
 */
export interface TokenSignature {
    /**
     * The authentication ID.
     */
    authId: string;
    /**
     * The current token.
     */
    current: string;
    /**
     * The signature of the token.
     */
    signature: string;
    /**
     * The original token.
     */
    originToken: LemonOAuthToken;
}

/**
 * Options for configuring the logger behavior.
 */
export interface LoggerOption {
    /**
     * Whether to show timestamps in the log output.
     */
    showTimestamp?: boolean;

    /**
     * Whether to show log types (e.g., info, error) in the log output.
     */
    showLogType?: boolean;
}

/**
 * Interface representing the body of a refresh token request.
 */
export interface RefreshTokenBody {
    /**
     * The current token.
     */
    current: string;
    /**
     * The signature of the token.
     */
    signature: string;
    /**
     * Optional. The domain of the token.
     */
    domain?: string;
}
