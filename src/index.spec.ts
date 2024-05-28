import { createAsyncDelay } from './index';

describe('createAsyncDelay', () => {
    it('should return undefined ', async () => {
        const result = await createAsyncDelay(0);
        expect(result).toBeFalsy();
    });
});
