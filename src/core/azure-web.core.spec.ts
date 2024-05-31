import { AzureWebCore } from '../core';
import { WebCoreConfig } from '../types';

describe('AzureWebCore', () => {
    let config: WebCoreConfig<'azure'>;
    let azureWebCore: AzureWebCore;

    beforeEach(() => {
        config = {
            project: 'test-project-azure',
            cloud: 'azure',
            oAuthEndpoint: 'http://localhost/oauth',
        };
        azureWebCore = new AzureWebCore(config);
    });

    it('should initialize correctly', async () => {
        const state = await azureWebCore.init();
        expect(state).toBe('no-token');
    });

    it('should build signed request correctly', async () => {
        const requestConfig = { method: 'GET', baseURL: 'http://localhost' };
        const builder = azureWebCore.buildSignedRequest(requestConfig);
        expect(builder).toBeDefined();
    });

    it('should get saved token correctly', async () => {
        const tokens = await azureWebCore.getSavedToken();
        expect(tokens).toEqual({});
    });

    it('should check authentication correctly', async () => {
        const isAuthenticated = await azureWebCore.isAuthenticated();
        expect(isAuthenticated).toBe(false);
    });
});
