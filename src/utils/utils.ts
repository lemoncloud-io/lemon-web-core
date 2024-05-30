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
