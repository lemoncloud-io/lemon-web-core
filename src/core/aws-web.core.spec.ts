import { AWSWebCore } from '../core';
import { LemonCredentials, LemonKMS, LemonOAuthToken, WebCoreConfig } from '../types';
import { AWSStorageService } from '../token-storage';
import { LoggerService } from '../utils';
import AWS from 'aws-sdk/global.js';
import axios from 'axios';

// Mock dependencies
jest.mock('../token-storage');
jest.mock('../utils');
jest.mock('axios');
jest.mock('aws-sdk/global.js', () => ({
    config: {
        credentials: null,
    },
    Credentials: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedAWSStorageService = AWSStorageService as jest.MockedClass<typeof AWSStorageService>;
const MockedLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('AWSWebCore', () => {
    let config: WebCoreConfig<'aws'>;
    let awsWebCore: AWSWebCore;
    let mockStorageService: jest.Mocked<AWSStorageService>;
    let mockLogger: jest.Mocked<LoggerService>;
    let mockAxiosInstance: any;

    const mockToken: LemonOAuthToken = {
        authId: 'test-auth-id',
        accountId: 'test-account-id',
        identityId: 'test-identity-id',
        identityToken: 'test-identity-token',
        identityPoolId: 'test-pool-id',
        credential: {
            AccessKeyId: 'test-access-key',
            SecretKey: 'test-secret-key',
            SessionToken: 'test-session-token',
        },
    };

    const mockCredentials: LemonCredentials = {
        AccessKeyId: 'test-access-key',
        SecretKey: 'test-secret-key',
        SessionToken: 'test-session-token',
    };

    beforeEach(() => {
        jest.clearAllMocks();

        config = {
            project: 'test-project-aws',
            cloud: 'aws',
            oAuthEndpoint: 'http://localhost/oauth',
        };

        // Setup axios mock
        mockAxiosInstance = {
            create: jest.fn().mockReturnThis(),
            request: jest.fn(),
        };
        mockedAxios.create.mockReturnValue(mockAxiosInstance);

        // Setup storage service mock
        mockStorageService = {
            initLemonConfig: jest.fn(),
            hasCachedToken: jest.fn(),
            shouldRefreshToken: jest.fn(),
            getCachedCredentials: jest.fn(),
            getCachedOAuthToken: jest.fn(),
            saveOAuthToken: jest.fn(),
            saveKMS: jest.fn(),
            clearOAuthToken: jest.fn(),
            getAllItems: jest.fn(),
            setItem: jest.fn(),
        } as any;
        MockedAWSStorageService.mockImplementation(() => mockStorageService);

        // Setup logger mock
        mockLogger = {
            warn: jest.fn(),
            info: jest.fn(),
            log: jest.fn(),
            error: jest.fn(),
        } as any;
        MockedLoggerService.mockImplementation(() => mockLogger);

        awsWebCore = new AWSWebCore(config);
    });

    describe('constructor', () => {
        it('should initialize with correct configuration', () => {
            expect(MockedAWSStorageService).toHaveBeenCalledWith(config);
            expect(MockedLoggerService).toHaveBeenCalledWith('AWSCore');
            expect(mockedAxios.create).toHaveBeenCalled();
        });
    });

    describe('getSharedAxiosInstance', () => {
        it('should return the shared axios instance', () => {
            const instance = awsWebCore.getSharedAxiosInstance();
            expect(instance).toBe(mockAxiosInstance);
        });
    });

    describe('init', () => {
        beforeEach(() => {
            mockStorageService.initLemonConfig.mockResolvedValue(undefined);
        });

        it('should return "no-token" when no cached token exists', async () => {
            mockStorageService.hasCachedToken.mockResolvedValue(false);

            const result = await awsWebCore.init();

            expect(result).toBe('no-token');
            expect(mockLogger.warn).toHaveBeenCalledWith('initialized without token!');
        });

        it('should return "refreshed" when token is refreshed successfully', async () => {
            mockStorageService.hasCachedToken
                .mockResolvedValueOnce(true) // Initial check
                .mockResolvedValueOnce(true); // After refresh check
            mockStorageService.shouldRefreshToken.mockResolvedValue(true);
            mockStorageService.getCachedOAuthToken.mockResolvedValue(mockToken);
            mockStorageService.getCachedCredentials.mockResolvedValue(mockCredentials);

            // Mock successful refresh
            jest.spyOn(awsWebCore as any, 'refreshCachedToken').mockResolvedValue(mockCredentials);
            jest.spyOn(awsWebCore as any, 'getCurrentCredentials').mockResolvedValue(mockCredentials);

            const result = await awsWebCore.init();

            expect(result).toBe('refreshed');
            expect(mockLogger.info).toHaveBeenCalledWith('initialized and refreshed token!');
        });

        it('should return "build" when building credentials from cached token', async () => {
            mockStorageService.hasCachedToken
                .mockResolvedValueOnce(true) // Initial check
                .mockResolvedValueOnce(true); // After refresh check
            mockStorageService.shouldRefreshToken.mockResolvedValue(false);
            mockStorageService.getCachedCredentials.mockResolvedValue(mockCredentials);

            const result = await awsWebCore.init();

            expect(result).toBe('build');
            expect(mockLogger.info).toHaveBeenCalledWith('initialized with token!');
        });

        it('should return "no-token" when refresh fails', async () => {
            mockStorageService.hasCachedToken
                .mockResolvedValueOnce(true) // Initial check
                .mockResolvedValueOnce(false); // After failed refresh
            mockStorageService.shouldRefreshToken.mockResolvedValue(true);

            jest.spyOn(awsWebCore as any, 'refreshCachedToken').mockResolvedValue(null);

            const result = await awsWebCore.init();

            expect(result).toBe('no-token');
        });
    });

    describe('getTokenStorage', () => {
        it('should return the token storage instance', () => {
            const storage = awsWebCore.getTokenStorage();
            expect(storage).toBe(mockStorageService);
        });
    });

    describe('buildRequest', () => {
        it('should create HttpRequestBuilder with correct config', () => {
            const requestConfig = { method: 'GET', url: '/test', baseURL: 'https://www.example.com' };
            const builder = awsWebCore.buildRequest(requestConfig);

            expect(builder).toBeDefined();
            // HttpRequestBuilder constructor would be called with config and axios instance
        });
    });

    describe('request', () => {
        it('should execute unsigned request successfully', async () => {
            const mockResponse = { data: { result: 'success' }, status: 200 };
            mockAxiosInstance.request.mockResolvedValue(mockResponse);

            const result = await awsWebCore.request('GET', '/test', { param: 'value' });

            expect(result).toEqual(mockResponse);
        });

        it('should handle request with body', async () => {
            const mockResponse = { data: { result: 'success' }, status: 200 };
            mockAxiosInstance.request.mockResolvedValue(mockResponse);
            const body = { data: 'test' };

            await awsWebCore.request('POST', '/test', {}, body);

            // Verify the request was made (implementation details would be tested in HttpRequestBuilder)
            expect(mockAxiosInstance.request).toHaveBeenCalled();
        });
    });

    describe('buildSignedRequest', () => {
        it('should create AWSHttpRequestBuilder with correct parameters', () => {
            const requestConfig = { method: 'POST', url: '/signed-test', baseURL: 'https://www.example.com' };
            const builder = awsWebCore.buildSignedRequest(requestConfig);

            expect(builder).toBeDefined();
            // AWSHttpRequestBuilder constructor would be called with storage, config, and axios
        });
    });

    describe('getSavedToken', () => {
        it('should return all stored tokens', async () => {
            const mockTokens = { 'token-key': 'token-value' };
            mockStorageService.getAllItems.mockResolvedValue(mockTokens);

            const result = await awsWebCore.getSavedToken();

            expect(result).toEqual(mockTokens);
            expect(mockStorageService.getAllItems).toHaveBeenCalled();
        });
    });

    describe('isAuthenticated', () => {
        it('should return false when no cached token exists', async () => {
            mockStorageService.hasCachedToken.mockResolvedValue(false);

            const result = await awsWebCore.isAuthenticated();

            expect(result).toBe(false);
        });

        it('should refresh token and return true when refresh is needed and succeeds', async () => {
            mockStorageService.hasCachedToken.mockResolvedValue(true);
            mockStorageService.shouldRefreshToken.mockResolvedValue(true);
            jest.spyOn(awsWebCore as any, 'refreshCachedToken').mockResolvedValue(mockCredentials);

            const result = await awsWebCore.isAuthenticated();

            expect(result).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith('return isAuthenticated after refresh token');
        });

        it('should return false when refresh fails', async () => {
            mockStorageService.hasCachedToken.mockResolvedValue(true);
            mockStorageService.shouldRefreshToken.mockResolvedValue(true);
            jest.spyOn(awsWebCore as any, 'refreshCachedToken').mockResolvedValue(null);

            const result = await awsWebCore.isAuthenticated();

            expect(result).toBe(false);
        });

        it('should check AWS credentials when no refresh needed', async () => {
            mockStorageService.hasCachedToken.mockResolvedValue(true);
            mockStorageService.shouldRefreshToken.mockResolvedValue(false);

            const mockCredentials = {
                get: jest.fn(callback => callback(null)),
            };
            (AWS.config as any).credentials = mockCredentials;

            const result = await awsWebCore.isAuthenticated();

            expect(result).toBe(true);
            expect(mockCredentials.get).toHaveBeenCalled();
        });

        it('should handle AWS credentials error', async () => {
            mockStorageService.hasCachedToken.mockResolvedValue(true);
            mockStorageService.shouldRefreshToken.mockResolvedValue(false);

            const error = new Error('AWS credentials error');
            const mockCredentials = {
                get: jest.fn(callback => callback(error)),
            };
            (AWS.config as any).credentials = mockCredentials;

            const result = await awsWebCore.isAuthenticated();

            expect(result).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith('get AWSConfig.credentials error: ', error);
        });
    });

    describe('buildCredentialsByToken', () => {
        it('should build AWS credentials from token successfully', async () => {
            const mockAWSCredentials = new AWS.Credentials('key', 'secret', 'token');
            (AWS.config as any).credentials = mockAWSCredentials;

            jest.spyOn(awsWebCore as any, 'buildAWSCredentialsByToken').mockResolvedValue(undefined);

            const result = await awsWebCore.buildCredentialsByToken(mockToken);

            expect(result).toBe(mockAWSCredentials);
            expect(mockLogger.log).toHaveBeenCalledWith('buildCredentialsByToken()...');
        });

        it('should throw error when AWS credentials are not built', async () => {
            (AWS.config as any).credentials = null;
            jest.spyOn(awsWebCore as any, 'buildAWSCredentialsByToken').mockResolvedValue(undefined);

            await expect(awsWebCore.buildCredentialsByToken(mockToken)).rejects.toThrow('Failed to build AWS credentials');
        });
    });

    describe('buildCredentialsByStorage', () => {
        it('should build AWS credentials from storage successfully', async () => {
            const mockAWSCredentials = new AWS.Credentials('key', 'secret', 'token');
            (AWS.config as any).credentials = mockAWSCredentials;

            jest.spyOn(awsWebCore as any, 'buildAWSCredentialsByStorage').mockResolvedValue(undefined);

            const result = await awsWebCore.buildCredentialsByStorage();

            expect(result).toBe(mockAWSCredentials);
            expect(mockLogger.log).toHaveBeenCalledWith('buildCredentialsByStorage()...');
        });

        it('should throw error when credentials cannot be built from storage', async () => {
            (AWS.config as any).credentials = null;
            jest.spyOn(awsWebCore as any, 'buildAWSCredentialsByStorage').mockResolvedValue(undefined);

            await expect(awsWebCore.buildCredentialsByStorage()).rejects.toThrow('Failed to build AWS credentials from storage');
        });
    });

    describe('saveKMS', () => {
        it('should save KMS configuration', async () => {
            const mockKMS: LemonKMS = { arn: 'test-kms-key' };
            mockStorageService.saveKMS.mockResolvedValue(undefined);

            await awsWebCore.saveKMS(mockKMS);

            expect(mockStorageService.saveKMS).toHaveBeenCalledWith(mockKMS);
            expect(mockLogger.log).toHaveBeenCalledWith('saveKMS()...');
        });
    });

    describe('refreshCachedToken', () => {
        beforeEach(() => {
            mockStorageService.getCachedOAuthToken.mockResolvedValue(mockToken);
            jest.spyOn(awsWebCore, 'signedRequest').mockResolvedValue({
                data: { ...mockToken, identityToken: 'new-identity-token' },
            } as any);
            jest.spyOn(awsWebCore, 'buildCredentialsByToken').mockResolvedValue({} as any);
        });

        it('should refresh token successfully', async () => {
            const result = await awsWebCore.refreshCachedToken();

            expect(result).toBeDefined();
            expect(mockLogger.info).toHaveBeenCalledWith('success to refresh token');
        });

        it('should refresh token with domain parameter', async () => {
            await awsWebCore.refreshCachedToken('test-domain');

            expect(awsWebCore.signedRequest).toHaveBeenCalledWith(
                'POST',
                `${config.oAuthEndpoint}/oauth/${mockToken.authId}/refresh`,
                {},
                expect.objectContaining({ domain: 'test-domain' })
            );
        });

        it('should use custom URL when provided', async () => {
            const customUrl = 'https://custom-oauth.example.com/refresh';

            await awsWebCore.refreshCachedToken('', customUrl);

            expect(awsWebCore.signedRequest).toHaveBeenCalledWith('POST', customUrl, {}, expect.any(Object));
        });

        it('should handle missing authId error', async () => {
            mockStorageService.getCachedOAuthToken.mockResolvedValue({ ...mockToken, authId: '' });

            const result = await awsWebCore.refreshCachedToken();

            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith('token refresh failed:', expect.any(Error));
        });

        it('should handle refresh request failure', async () => {
            jest.spyOn(awsWebCore, 'signedRequest').mockRejectedValue(new Error('Network error'));

            const result = await awsWebCore.refreshCachedToken();

            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith('token refresh failed:', expect.any(Error));
        });
    });

    describe('changeUserSite', () => {
        const changeSiteBody = { siteId: 'new-site-id', userId: 'user-123' };

        beforeEach(() => {
            mockStorageService.getCachedOAuthToken.mockResolvedValue(mockToken);
            jest.spyOn(awsWebCore, 'getTokenSignature').mockResolvedValue({
                authId: 'test-auth-id',
                current: '2023-01-01T00:00:00.000Z',
                signature: 'test-signature',
                originToken: mockToken,
            });
            jest.spyOn(awsWebCore, 'signedRequest').mockResolvedValue({
                data: { ...mockToken, identityToken: 'new-site-token' },
            } as any);
            jest.spyOn(awsWebCore, 'buildCredentialsByToken').mockResolvedValue({} as any);
        });

        it('should change user site successfully', async () => {
            const result = await awsWebCore.changeUserSite(changeSiteBody);

            expect(result).toBeDefined();
            expect(mockLogger.info).toHaveBeenCalledWith('success to change user site');
            expect(awsWebCore.signedRequest).toHaveBeenCalledWith(
                'POST',
                `${config.oAuthEndpoint}/oauth/test-auth-id/refresh`,
                {},
                expect.objectContaining({
                    target: 'user-123@new-site-id',
                })
            );
        });

        it('should use custom URL when provided', async () => {
            const customUrl = 'https://custom-site-change.example.com';

            await awsWebCore.changeUserSite(changeSiteBody, customUrl);

            expect(awsWebCore.signedRequest).toHaveBeenCalledWith('POST', customUrl, {}, expect.any(Object));
        });

        it('should throw error for invalid changeSiteBody', async () => {
            await expect(awsWebCore.changeUserSite(null as any)).rejects.toThrow('@changeSiteBody required');

            await expect(awsWebCore.changeUserSite({ siteId: '', userId: 'user' })).rejects.toThrow('@changeSiteBody required');

            await expect(awsWebCore.changeUserSite({ siteId: 'site', userId: '' })).rejects.toThrow('@changeSiteBody required');
        });
    });

    describe('logout', () => {
        it('should clear AWS credentials and cached tokens', async () => {
            mockStorageService.clearOAuthToken.mockResolvedValue(undefined);

            await awsWebCore.logout();

            expect(AWS.config.credentials).toBeNull();
            expect(mockStorageService.clearOAuthToken).toHaveBeenCalled();
        });
    });

    describe('setUseXLemonIdentity', () => {
        it('should set X-Lemon-Identity usage flag', async () => {
            mockStorageService.setItem.mockResolvedValue(undefined);

            await awsWebCore.setUseXLemonIdentity(true);

            expect(mockStorageService.setItem).toHaveBeenCalledWith('use_x_lemon_identity_key', 'true');
        });
    });

    describe('setUseXLemonLanguage', () => {
        it('should set X-Lemon-Language with key when use is true', async () => {
            mockStorageService.setItem.mockResolvedValue(undefined);

            await awsWebCore.setUseXLemonLanguage(true, 'en-US');

            expect(mockStorageService.setItem).toHaveBeenCalledWith('use_x_lemon_language_key', 'en-US');
        });

        it('should clear X-Lemon-Language when use is false', async () => {
            mockStorageService.setItem.mockResolvedValue(undefined);

            await awsWebCore.setUseXLemonLanguage(false);

            expect(mockStorageService.setItem).toHaveBeenCalledWith('use_x_lemon_language_key', '');
        });

        it('should not set language when use is true but no key provided', async () => {
            await awsWebCore.setUseXLemonLanguage(true);

            expect(mockStorageService.setItem).not.toHaveBeenCalled();
        });
    });

    describe('getTokenSignature', () => {
        it('should generate token signature correctly', async () => {
            mockStorageService.getCachedOAuthToken.mockResolvedValue(mockToken);

            // Mock calcSignature utility
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { calcSignature } = require('../utils');
            calcSignature.mockReturnValue('calculated-signature');

            const result = await awsWebCore.getTokenSignature();

            expect(result).toEqual({
                authId: mockToken.authId,
                current: expect.any(String),
                signature: 'calculated-signature',
                originToken: mockToken,
            });
            expect(calcSignature).toHaveBeenCalledWith(
                {
                    authId: mockToken.authId,
                    accountId: mockToken.accountId,
                    identityId: mockToken.identityId,
                    identityToken: mockToken.identityToken,
                },
                expect.any(String)
            );
        });
    });

    describe('getCredentials', () => {
        it('should return null when no cached token exists', async () => {
            mockStorageService.hasCachedToken.mockResolvedValue(false);

            const result = await awsWebCore.getCredentials();

            expect(result).toBeNull();
            expect(mockLogger.info).toHaveBeenCalledWith('has no cached token!');
        });

        it('should return current credentials when no refresh needed', async () => {
            mockStorageService.hasCachedToken.mockResolvedValue(true);
            mockStorageService.shouldRefreshToken.mockResolvedValue(false);
            jest.spyOn(awsWebCore as any, 'getCurrentCredentials').mockResolvedValue(mockCredentials);

            const result = await awsWebCore.getCredentials();

            expect(result).toBe(mockCredentials);
        });

        it('should return null when refresh fails', async () => {
            mockStorageService.hasCachedToken.mockResolvedValue(true);
            mockStorageService.shouldRefreshToken.mockResolvedValue(true);
            jest.spyOn(awsWebCore as any, 'refreshCachedToken').mockResolvedValue(null);

            const result = await awsWebCore.getCredentials();

            expect(result).toBeNull();
        });
    });
});
