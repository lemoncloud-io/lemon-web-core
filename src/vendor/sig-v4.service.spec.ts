import { sigV4Client } from './sig-v4.service';

describe('sigV4Client', () => {
    const credentials = {
        accessKey: 'AKIAEXAMPLE',
        secretKey: 'secret-key',
        sessionToken: 'session-token',
        region: 'ap-northeast-2',
    };

    describe('newClient', () => {
        it('should split a valid endpoint into origin and path', () => {
            const client = sigV4Client.newClient({
                ...credentials,
                endpoint: 'https://api.lemoncloud.io/v1/oauth',
                host: 'api.lemoncloud.io',
            });

            expect(client.endpoint).toBe('https://api.lemoncloud.io');
            expect(client.pathComponent).toBe('/v1/oauth');
        });

        // The origin match can fail, and reading [1] off the null result used to throw a TypeError
        // pointing at the regex rather than at the caller's endpoint.
        it('should reject an endpoint that carries no http(s) origin', () => {
            expect(() =>
                sigV4Client.newClient({
                    ...credentials,
                    endpoint: 'api.lemoncloud.io/v1/oauth',
                    host: 'api.lemoncloud.io',
                })
            ).toThrow('@endpoint (string) must start with http:// or https://');
        });
    });

    describe('signRequest', () => {
        it('should produce an AWS4-HMAC-SHA256 authorization header', () => {
            const client = sigV4Client.newClient({
                ...credentials,
                endpoint: 'https://api.lemoncloud.io',
                host: 'api.lemoncloud.io',
            });

            const signed = client.signRequest({
                method: 'GET',
                path: '/v1/oauth',
                headers: {},
                queryParams: {},
                body: {},
            });

            expect(signed.headers.Authorization).toContain('AWS4-HMAC-SHA256');
            expect(signed.headers.Authorization).toContain('AKIAEXAMPLE');
            expect(signed.headers['x-amz-security-token']).toBe('session-token');
        });
    });
});
