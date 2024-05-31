import { TokenStorageService } from '../token-storage';
import { WebCoreConfig } from '../types';

class MockTokenStorageService extends TokenStorageService {
    async getAllItems(): Promise<{ [key: string]: string }> {
        return {};
    }

    async hasCachedToken(): Promise<boolean> {
        return false;
    }

    async shouldRefreshToken(): Promise<boolean> {
        return false;
    }
}

describe('TokenStorageService', () => {
    let config: WebCoreConfig<'aws'>;
    let tokenStorage: TokenStorageService;

    beforeEach(() => {
        config = {
            project: 'test-project',
            cloud: 'aws',
            oAuthEndpoint: 'http://localhost/oauth',
        };
        tokenStorage = new MockTokenStorageService(config);
    });

    it('should set item correctly', async () => {
        await tokenStorage.setItem('key', 'value');
        const item = await tokenStorage.getItem('key');
        expect(item).toBe('value');
    });

    it('should get item correctly', async () => {
        await tokenStorage.setItem('key', 'value');
        const item = await tokenStorage.getItem('key');
        expect(item).toBe('value');
    });

    it('should update prefix correctly', () => {
        tokenStorage.updatePrefix('new-prefix');
        expect(tokenStorage['prefix']).toBe('@new-prefix');
    });
});
