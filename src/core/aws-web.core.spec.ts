import { AWSWebCore } from '../core';
import { WebCoreConfig } from '../types';

describe('AWSWebCore', () => {
    let config: WebCoreConfig<'aws'>;
    let awsWebCore: AWSWebCore;

    beforeEach(() => {
        config = {
            project: 'test-project-aws',
            cloud: 'aws',
            oAuthEndpoint: 'http://localhost/oauth',
        };
        awsWebCore = new AWSWebCore(config);
    });

    it('should initialize correctly', async () => {
        const state = await awsWebCore.init();
        expect(state).toBe('no-token');
    });

    it('should build signed request correctly', async () => {
        const requestConfig = { method: 'GET', baseURL: 'http://localhost' };
        const builder = awsWebCore.buildSignedRequest(requestConfig);
        expect(builder).toBeDefined();
    });

    it('should get saved token correctly', async () => {
        const tokens = await awsWebCore.getSavedToken();
        expect(tokens).toEqual({});
    });

    it('should check authentication correctly', async () => {
        const isAuthenticated = await awsWebCore.isAuthenticated();
        expect(isAuthenticated).toBe(false);
    });
});
