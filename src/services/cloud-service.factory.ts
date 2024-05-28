import { CloudService } from './cloud.service';
import { LemonOptions } from '../types';

/**
 * Factory class for creating instances of CloudService.
 */
export class CloudServiceFactory {
    /**
     * Creates an instance of a specified CloudService subclass.
     * @template T - The type of CloudService.
     * @param {new (params: LemonOptions) => T} className - The constructor of the CloudService subclass.
     * @param {LemonOptions} params - The initialization parameters.
     * @returns {T} - An instance of the specified CloudService subclass.
     */
    static create<T extends CloudService>(className: { new (params: LemonOptions): T }, params: LemonOptions): T {
        return new className(params);
    }
}
