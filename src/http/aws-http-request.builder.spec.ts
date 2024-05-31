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
        tokenStorage = new AWSStorageService({ project: 'test', cloud: 'aws', oAuthEndpoint: 'http://localhost' });
        config = {
            method: 'GET',
            baseURL: 'http://localhost',
        };
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
        mockedAxios.mockResolvedValue({ data: 'response' });
        expect(mockedAxios).toHaveBeenCalledWith(expect.objectContaining(config));

        const mockedRequest = axios.request as jest.Mock;
        mockedRequest.mockResolvedValue({ data: 'response' });
        const response = await builder.execute();
        expect(response.data).toBe('response');
    });
});
