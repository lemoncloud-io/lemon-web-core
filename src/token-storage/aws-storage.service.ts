import { LemonCredentials, LemonKMS, LemonOAuthToken, WebCoreConfig } from '../types';
import { REGION_KEY, TokenStorageService, USE_X_LEMON_IDENTITY_KEY } from './token-storage.service';
import { convertCamelCaseFromSnake } from '../utils';

export class AWSStorageService extends TokenStorageService {
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

    constructor(readonly config: WebCoreConfig<'aws'>) {
        super(config);
    }

    async initLemonConfig() {
        await this.setItem(USE_X_LEMON_IDENTITY_KEY, 'true');
        await this.setItem(REGION_KEY, this.config.region || 'ap-northeast-2');
    }

    async getAllItems() {
        return await this.credentialKeys.reduce(async (promise, item) => {
            const result: { [key: string]: string } = await promise.then();
            result[`${this.prefix}.${item}`] = await this.storage.getItem(`${this.prefix}.${item}`);
            return Promise.resolve(result);
        }, Promise.resolve({}));
    }

    async hasCachedToken(): Promise<boolean> {
        const expiredTime = await this.storage.getItem(`${this.prefix}.expired_time`);
        const accessKeyId = await this.storage.getItem(`${this.prefix}.access_key_id`);
        const secretKey = await this.storage.getItem(`${this.prefix}.secret_key`);
        const identityToken = await this.storage.getItem(`${this.prefix}.identity_token`);

        return !!accessKeyId && !!secretKey && !!expiredTime && !!identityToken;
    }

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

    async getCachedCredentials(): Promise<LemonCredentials> {
        const AccessKeyId = await this.storage.getItem(`${this.prefix}.access_key_id`);
        const SecretKey = await this.storage.getItem(`${this.prefix}.secret_key`);
        const SessionToken = await this.storage.getItem(`${this.prefix}.session_token`);
        return { AccessKeyId, SecretKey, SessionToken } as LemonCredentials;
    }

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

    async saveOAuthToken(token: LemonOAuthToken): Promise<void> {
        const { accountId, authId, credential, identityId, identityPoolId, identityToken } = token;
        const { AccessKeyId, SecretKey, SessionToken, Expiration } = credential;

        // save items...
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

    async clearOAuthToken(): Promise<void> {
        await Promise.all(this.credentialKeys.map(item => this.storage.removeItem(`${this.prefix}.${item}`)));
        return;
    }

    async saveKMS(kms: LemonKMS): Promise<void> {
        const kmsArn = kms.arn;
        this.storage.setItem(`${this.prefix}.kms_arn`, kmsArn || '');
        return;
    }
}
