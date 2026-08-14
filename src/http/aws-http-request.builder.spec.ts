import axios, { AxiosRequestConfig } from 'axios';
import { AWSHttpRequestBuilder } from '../http';
import { AWSStorageService } from '../token-storage';

jest.mock('axios', () => {
    return {
        create: jest.fn(() => axios),
        request: jest.fn(() => Promise.resolve()),
    };
});

describe('AWSHttpRequestBuilder', () => {
    let tokenStorage: AWSStorageService;
    let config: AxiosRequestConfig;

    beforeEach(() => {
        jest.clearAllMocks();
        tokenStorage = new AWSStorageService({ project: 'test', cloud: 'aws', oAuthEndpoint: 'http://localhost' });
        config = {
            method: 'GET',
            baseURL: 'http://localhost',
        };
    });

    const executeAndCaptureConfig = async (credentials: { AccessKeyId: string; SecretKey: string; SessionToken: string }) => {
        jest.spyOn(tokenStorage, 'getCachedCredentials').mockResolvedValue(credentials);
        jest.spyOn(tokenStorage, 'getItem').mockResolvedValue('');

        const mockedRequest = axios.request as jest.Mock;
        mockedRequest.mockResolvedValue({ data: 'response' });

        await new AWSHttpRequestBuilder(tokenStorage, config).execute();
        return mockedRequest.mock.calls[mockedRequest.mock.calls.length - 1][0];
    };

    // Signing reads credentials from token storage. It used to read the AWS.config global, which meant
    // a page that never called init() sent unsigned requests even with credentials in storage.
    it('should sign the request with the credentials held in token storage', async () => {
        const sentConfig = await executeAndCaptureConfig({
            AccessKeyId: 'AKIAEXAMPLE',
            SecretKey: 'secret-key',
            SessionToken: 'session-token',
        });

        expect(sentConfig.headers.Authorization).toContain('AWS4-HMAC-SHA256');
        expect(sentConfig.headers.Authorization).toContain('AKIAEXAMPLE');
        expect(sentConfig.headers['x-amz-security-token']).toBe('session-token');
    });

    it('should send an unsigned request when token storage holds no credentials', async () => {
        const sentConfig = await executeAndCaptureConfig({ AccessKeyId: '', SecretKey: '', SessionToken: '' });

        expect(sentConfig.headers.Authorization).toBeUndefined();
    });

    it('should set headers correctly', async () => {
        const builder = new AWSHttpRequestBuilder(tokenStorage, config);
        builder.setHeaders({ 'Content-Type': 'application/json' });
        expect(builder['config'].headers).toEqual({ 'Content-Type': 'application/json' });
    });

    it('should set params correctly', async () => {
        const builder = new AWSHttpRequestBuilder(tokenStorage, config);
        builder.setParams({ page: 1 });
        expect(builder['config'].params).toEqual({ page: 1 });
    });

    it('should set body correctly', async () => {
        const builder = new AWSHttpRequestBuilder(tokenStorage, config);
        builder.setBody({ data: 'test' });
        expect(builder['config'].data).toEqual({ data: 'test' });
    });

    it('should execute request correctly', async () => {
        const builder = new AWSHttpRequestBuilder(tokenStorage, config);
        const mockedAxios = axios.create as jest.Mock;
        expect(mockedAxios).toHaveBeenCalledWith(expect.objectContaining(config));

        const mockedRequest = axios.request as jest.Mock;
        mockedRequest.mockResolvedValue({ data: 'response' });
        const response = await builder.execute();
        expect(response.data).toBe('response');
    });
});
