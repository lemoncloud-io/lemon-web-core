import { LemonCredentials, LemonKMS, LemonOAuthToken, WebCoreConfig } from '../types';
import { REGION_KEY, TokenStorageService, USE_X_LEMON_IDENTITY_KEY } from './token-storage.service';

export class AWSStorageService extends TokenStorageService {
    private credentialKeys = [
        'accountId',
        'authId',
        'identityId',
        'identityPoolId',
        'identityToken',
        'accessKeyId',
        'secretKey',
        'sessionToken',
        'expiredTime',
        'kmsArn',
    ];

    constructor(readonly config: WebCoreConfig<'aws'>) {
        super(config);
        this.initLemonConfig().then(() => {});
    }

    async initLemonConfig() {
        await this.setItem(USE_X_LEMON_IDENTITY_KEY, 'true');
        await this.setItem(REGION_KEY, this.config.region || 'ap-northeast-2');
    }

    async getAllItems() {
        return await this.credentialKeys.reduce(async (promise, item) => {
            const tmpResult: { [key: string]: string } = await promise.then();
            tmpResult[`${this.prefix}.${item}`] = await this.storage.getItem(`${this.prefix}.${item}`);
            return Promise.resolve(tmpResult);
        }, Promise.resolve({}));
    }

    async hasCachedToken(): Promise<boolean> {
        const expiredTime = await this.storage.getItem(`${this.prefix}.expiredTime`);
        const accessKeyId = await this.storage.getItem(`${this.prefix}.accessKeyId`);
        const secretKey = await this.storage.getItem(`${this.prefix}.secretKey`);

        return !!accessKeyId && !!secretKey && !!expiredTime;
    }

    async shouldRefreshToken(): Promise<boolean> {
        const expiredTime = +(await this.storage.getItem(`${this.prefix}.expiredTime`));
        const now = new Date().getTime();
        return now >= expiredTime;
    }

    async getCachedCredentials(): Promise<LemonCredentials> {
        const AccessKeyId = await this.storage.getItem(`${this.prefix}.accessKeyId`);
        const SecretKey = await this.storage.getItem(`${this.prefix}.secretKey`);
        const SessionToken = await this.storage.getItem(`${this.prefix}.sessionToken`);
        return { AccessKeyId, SecretKey, SessionToken } as LemonCredentials;
    }

    async getCachedOAuthToken(): Promise<LemonOAuthToken> {
        const result: any = await this.credentialKeys.reduce(async (promise, item) => {
            const tmp: { [key: string]: string } = await promise.then();
            tmp[item] = await this.storage.getItem(`${this.prefix}.${item}`);
            return Promise.resolve(tmp);
        }, Promise.resolve({}));

        const AccessKeyId = await this.storage.getItem(`${this.prefix}.accessKeyId`);
        const SecretKey = await this.storage.getItem(`${this.prefix}.secretKey`);
        const SessionToken = await this.storage.getItem(`${this.prefix}.sessionToken`);
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
        const { AccessKeyId, SecretKey, SessionToken } = credential;

        // save items...
        this.storage.setItem(`${this.prefix}.accountId`, accountId || '');
        this.storage.setItem(`${this.prefix}.authId`, authId || '');
        this.storage.setItem(`${this.prefix}.identityId`, identityId || '');
        this.storage.setItem(`${this.prefix}.identityToken`, identityToken || '');

        this.storage.setItem(`${this.prefix}.identityPoolId`, identityPoolId || '');
        this.storage.setItem(`${this.prefix}.accessKeyId`, AccessKeyId || '');
        this.storage.setItem(`${this.prefix}.secretKey`, SecretKey || '');
        this.storage.setItem(`${this.prefix}.sessionToken`, SessionToken || '');

        // set expired time
        const TIME_DELAY = 0.5; // 0.5 = 30minutes, 1 = 1hour
        const expiredTime = new Date().getTime() + TIME_DELAY * 60 * 60 * 1000; // 30 minutes
        this.storage.setItem(`${this.prefix}.expiredTime`, expiredTime.toString());

        return;
    }

    async clearOAuthToken(): Promise<void> {
        await Promise.all(this.credentialKeys.map(item => this.storage.removeItem(`${this.prefix}.${item}`)));
        return;
    }

    async saveKMS(kms: LemonKMS): Promise<void> {
        const kmsArn = kms.arn;
        this.storage.setItem(`${this.prefix}.kmsArn`, kmsArn || '');
        return;
    }
}
