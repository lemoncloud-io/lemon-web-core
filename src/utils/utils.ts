import { SignaturePayload } from '../types';
import hmacSHA256 from 'crypto-js/hmac-sha256.js';
import encBase64 from 'crypto-js/enc-base64.js';

/**
 * @description create delay using async/await
 * @param {number} duration (millisecond)
 * @returns {Promise}
 * @example
 * await createAsyncDelay(2000) // wait 2 seconds
 * */
export const createAsyncDelay = (duration: number) => {
    return new Promise<void>(resolve => setTimeout(() => resolve(), duration));
};

export const isEmptyObject = (obj: any) => {
    if (typeof obj !== 'object') {
        return !obj;
    }
    return Object.keys(obj).length === 0;
};

export const withRetries =
    (attempt: any, nthTry: number, delay: number) =>
    async (...args: any[]) => {
        let retryCount = 0;
        do {
            try {
                return await attempt(...args);
            } catch (error) {
                const isLastAttempt = retryCount === nthTry;
                if (isLastAttempt) {
                    return Promise.reject(error);
                }
            }
            await createAsyncDelay(delay);
        } while (retryCount++ < nthTry);
    };

export const hmac = (message: string, key: string) => {
    //! INFO: lemon-account-api
    //! algorithm: sha256, encoding: base64
    const hash = hmacSHA256(message, key);
    return encBase64.stringify(hash);
};

export const calcSignature = (
    payload: SignaturePayload,
    current: string = new Date().toISOString(),
    userAgent: string = navigator.userAgent
) => {
    const authId = payload.authId || '';
    const accountId = payload.accountId || '';
    const identityId = payload.identityId || '';
    const identityToken = '';

    //! build payload to sign......
    const data = [current, accountId, identityId, identityToken, userAgent].join('&');
    //! make signature with auth-id
    const signature = hmac(hmac(hmac(data, authId), accountId), identityId);
    //! returns signature..........
    // return new Buffer(signature).toString('base64');
    return signature;
};

export const convertCamelCaseFromSnake = (key: string) => {
    return key
        .toLowerCase()
        .split('_')
        .map((part, i) => (i > 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join('');
};

export const convertSnakeCaseFromCamel = (key: string) => {
    return key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

export const getStorageKey = (prefix: string, key: string, useSnakeCase: boolean = true) => {
    const storageKey = useSnakeCase ? key : convertCamelCaseFromSnake(key);
    return `${prefix}.${storageKey}`;
};

export const getStorageKeyVariants = (prefix: string, key: string) => {
    const snakeKey = `${prefix}.${key}`;
    const camelKey = `${prefix}.${convertCamelCaseFromSnake(key)}`;
    return { snakeKey, camelKey };
};

export const getStorageValue = async (storage: any, prefix: string, key: string): Promise<string | null> => {
    const { snakeKey, camelKey } = getStorageKeyVariants(prefix, key);

    // Try snake_case first (backward compatibility)
    const snakeValue = await storage.getItem(snakeKey);
    if (snakeValue) {
        return snakeValue;
    }

    // Try camelCase as fallback
    const camelValue = await storage.getItem(camelKey);
    return camelValue;
};

// NOTE: for native login test
export const calcTestSignature = (
    payload: SignaturePayload,
    current: string = new Date().toISOString(),
    userAgent: string = navigator.userAgent
) => {
    const authId = payload.authId || '';
    const accountId = payload.accountId || '';
    const identityId = payload.identityId || '';
    const identityToken = payload.identityToken || '';

    //! build payload to sign......
    const data = [current, accountId, identityId, identityToken, userAgent].join('&');
    //! make signature with auth-id
    const signature = hmac(hmac(hmac(data, authId), accountId), identityId);
    //! returns signature..........
    // return new Buffer(signature).toString('base64');
    return signature;
};
