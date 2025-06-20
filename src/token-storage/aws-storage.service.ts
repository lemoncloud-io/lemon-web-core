import { LemonCredentials, LemonKMS, LemonOAuthToken, WebCoreConfig } from '../types';
import { REGION_KEY, TokenStorageService, USE_X_LEMON_IDENTITY_KEY } from './token-storage.service';
import { convertCamelCaseFromSnake } from '../utils';

/**
 * AWS-specific token storage service that manages OAuth tokens, credentials, and KMS configuration.
 * Extends TokenStorageService to provide AWS Cognito and STS token management capabilities.
 */
export class AWSStorageService extends TokenStorageService {
    /**
     * List of credential keys stored in the token storage.
     * These keys represent the complete set of AWS authentication data.
     */
    private credentialKeys = [
        'account_id',
        'auth_id',
        'identity_id',
        'identity_pool_id',
        'identity_token',
        'access_key_id',
        'secret_key',
        'session_token',
        'expired_time',
        'issued_time',
        'kms_arn',
    ];

    /**
     * Creates an instance of AWSStorageService.
     * @param {WebCoreConfig<'aws'>} config - AWS-specific web core configuration
     */
    constructor(readonly config: WebCoreConfig<'aws'>) {
        super(config);
    }

    /**
     * Initializes Lemon configuration by setting default values for identity usage and region.
     * Sets up the storage with required configuration flags and regional settings.
     * @returns {Promise<void>} Promise that resolves when initialization is complete
     */
    async initLemonConfig() {
        await this.setItem(USE_X_LEMON_IDENTITY_KEY, 'true');
        await this.setItem(REGION_KEY, this.config.region || 'ap-northeast-2');
    }

    /**
     * Retrieves all stored credential items as a key-value map.
     * Useful for debugging or bulk operations on stored credentials.
     * @returns {Promise<{[key: string]: string}>} Promise resolving to object with all credential key-value pairs
     */
    async getAllItems() {
        return await this.credentialKeys.reduce(async (promise, item) => {
            const result: { [key: string]: string } = await promise.then();
            result[`${this.prefix}.${item}`] = await this.storage.getItem(`${this.prefix}.${item}`);
            return Promise.resolve(result);
        }, Promise.resolve({}));
    }

    /**
     * Checks if valid cached tokens exist in storage.
     * Validates the presence of essential token components required for AWS authentication.
     * @returns {Promise<boolean>} Promise resolving to true if all required tokens are cached
     */
    async hasCachedToken(): Promise<boolean> {
        const expiredTime = await this.storage.getItem(`${this.prefix}.expired_time`);
        const accessKeyId = await this.storage.getItem(`${this.prefix}.access_key_id`);
        const secretKey = await this.storage.getItem(`${this.prefix}.secret_key`);
        const identityToken = await this.storage.getItem(`${this.prefix}.identity_token`);

        return !!accessKeyId && !!secretKey && !!expiredTime && !!identityToken;
    }

    /**
     * Determines whether the stored token should be refreshed based on expiration time.
     * Uses a 5-minute buffer before actual expiration to ensure token validity.
     * @returns {Promise<boolean>} Promise resolving to true if token should be refreshed
     */
    async shouldRefreshToken(): Promise<boolean> {
        const expiredTime = +(await this.storage.getItem(`${this.prefix}.expired_time`));
        const now = new Date().getTime();

        if (!expiredTime || expiredTime <= 0) {
            return false;
        }

        if (now >= expiredTime) {
            return true;
        }

        const bufferTime = 5 * 60 * 1000;
        return now >= expiredTime - bufferTime;
    }

    /**
     * Retrieves cached AWS credentials (access key, secret key, session token).
     * Returns the credentials in the format expected by AWS SDK.
     * @returns {Promise<LemonCredentials>} Promise resolving to AWS credentials object
     */
    async getCachedCredentials(): Promise<LemonCredentials> {
        const AccessKeyId = await this.storage.getItem(`${this.prefix}.access_key_id`);
        const SecretKey = await this.storage.getItem(`${this.prefix}.secret_key`);
        const SessionToken = await this.storage.getItem(`${this.prefix}.session_token`);
        return { AccessKeyId, SecretKey, SessionToken } as LemonCredentials;
    }

    /**
     * Retrieves and transforms cached OAuth token data.
     * Converts snake_case storage keys to camelCase and structures the data for OAuth usage.
     * Excludes sensitive credential details from the returned object.
     * @returns {Promise<LemonOAuthToken>} Promise resolving to formatted OAuth token object
     */
    async getCachedOAuthToken(): Promise<LemonOAuthToken> {
        const result: any = await this.credentialKeys.reduce(async (promise, item) => {
            const tmp: { [key: string]: string } = await promise.then();
            tmp[convertCamelCaseFromSnake(item)] = await this.storage.getItem(`${this.prefix}.${item}`);
            return Promise.resolve(tmp);
        }, Promise.resolve({}));

        const AccessKeyId = await this.storage.getItem(`${this.prefix}.access_key_id`);
        const SecretKey = await this.storage.getItem(`${this.prefix}.secret_key`);
        const SessionToken = await this.storage.getItem(`${this.prefix}.session_token`);
        result.credential = { AccessKeyId, SecretKey, SessionToken };

        delete result.accessKeyId;
        delete result.secretKey;
        delete result.sessionToken;
        delete result.expiredTime;
        delete result.kmsArn;

        return result as LemonOAuthToken;
    }

    /**
     * Saves OAuth token and associated AWS credentials to storage.
     * Calculates and stores expiration and issued times for token lifecycle management.
     * @param {LemonOAuthToken} token - OAuth token object containing credentials and metadata
     * @returns {Promise<void>} Promise that resolves when save operation is complete
     */
    async saveOAuthToken(token: LemonOAuthToken): Promise<void> {
        const { accountId, authId, credential, identityId, identityPoolId, identityToken } = token;
        const { AccessKeyId, SecretKey, SessionToken, Expiration } = credential;

        this.storage.setItem(`${this.prefix}.account_id`, accountId || '');
        this.storage.setItem(`${this.prefix}.auth_id`, authId || '');
        this.storage.setItem(`${this.prefix}.identity_id`, identityId || '');
        this.storage.setItem(`${this.prefix}.identity_token`, identityToken || '');

        this.storage.setItem(`${this.prefix}.identity_pool_id`, identityPoolId || '');
        this.storage.setItem(`${this.prefix}.access_key_id`, AccessKeyId || '');
        this.storage.setItem(`${this.prefix}.secret_key`, SecretKey || '');
        this.storage.setItem(`${this.prefix}.session_token`, SessionToken || '');

        const expiredTime = this.calculateTokenExpiration(Expiration, identityToken);
        this.storage.setItem(`${this.prefix}.expired_time`, expiredTime.toString());

        const issuedTime = this.calculateTokenIssuedTime(identityToken);
        if (issuedTime) {
            this.storage.setItem(`${this.prefix}.issued_time`, issuedTime.toString());
        }

        return;
    }

    /**
     * Removes all stored OAuth tokens and credentials from storage.
     * Performs complete cleanup of all credential-related storage keys.
     * @returns {Promise<void>} Promise that resolves when all tokens are cleared
     */
    async clearOAuthToken(): Promise<void> {
        await Promise.all(this.credentialKeys.map(item => this.storage.removeItem(`${this.prefix}.${item}`)));
        return;
    }

    /**
     * Saves KMS (Key Management Service) configuration to storage.
     * Stores the KMS ARN for encryption/decryption operations.
     * @param {LemonKMS} kms - KMS configuration object containing ARN
     * @returns {Promise<void>} Promise that resolves when KMS data is saved
     */
    async saveKMS(kms: LemonKMS): Promise<void> {
        const kmsArn = kms.arn;
        this.storage.setItem(`${this.prefix}.kms_arn`, kmsArn || '');
        return;
    }
}
