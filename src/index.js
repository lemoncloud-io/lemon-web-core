'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.createAsyncDelay = void 0;
/**
 * @description create delay using async/await
 * @param {number} duration (millisecond)
 * @returns {Promise}
 * @example
 * await createAsyncDelay(2000) // wait 2 seconds
 * */
const createAsyncDelay = duration => {
    return new Promise(resolve => setTimeout(() => resolve(), duration));
};
exports.createAsyncDelay = createAsyncDelay;
