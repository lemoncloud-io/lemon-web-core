import { format as nodeFormat } from 'util';
import { LoggerHelperService } from './logger-helper.service';
import { LogType } from './logger.service';

describe('LoggerHelperService', () => {
    let helper: LoggerHelperService;

    beforeEach(() => {
        helper = new LoggerHelperService();
    });

    describe('formatMessage', () => {
        // The local formatter replaced Node's util.format, a builtin this browser library should
        // not import. util.format is the independent oracle: jest runs under node, so it is
        // available here even though the library no longer uses it.
        const equivalent: Array<[string, any[]]> = [
            ['no placeholders', []],
            ['plain %s here', ['value']],
            ['%s and %s', ['first', 'second']],
            ['%d items', [42]],
            ['%i truncated', [3.9]],
            ['%f float', [1.5]],
            ['%j json', [{ a: 1 }]],
            ['literal %% sign', []],
            ['literal %% sign with %s', ['arg']],
            ['too few args %s %s', ['only']],
            ['no placeholder', ['appended', 'extra']],
            ['%s then extras', ['used', 'left', 'over']],
            ['%d then extras', [1, 2]],
            ['count is %s', [7]],
            // Types the logger can be handed that the placeholders treat specially. %d used to throw
            // on a symbol, which is the worst thing a logger can do.
            ['%d symbol', [Symbol('sym')]],
            ['%i symbol', [Symbol('sym')]],
            ['%f symbol', [Symbol('sym')]],
            ['%s symbol', [Symbol('sym')]],
            ['%d bigint', [BigInt(1)]],
            ['%i bigint', [BigInt(2)]],
            ['%s bigint', [BigInt(3)]],
            ['%f bigint', [BigInt(4)]],
            ['%j string', ['abc']],
            ['%j number', [1]],
            ['%j null', [null]],
            ['%j undefined', [undefined]],
            ['%s null', [null]],
            ['%s undefined', [undefined]],
            ['%d unparseable', ['12abc']],
            ['%d negative zero', [-0]],
            ['%s negative zero', [-0]],
            ['%i negative zero', [-0]],
            ['%f negative zero', [-0]],
            ['appended negative zero', [-0]],
        ];

        it.each(equivalent)('should match util.format for %p', (message, params) => {
            expect(helper.formatMessage(message, params)).toBe(nodeFormat(message, ...params));
        });

        // Documented deviation: objects render as JSON instead of through util.inspect.
        it('should render objects as JSON rather than inspect output', () => {
            expect(helper.formatMessage('%o object', [{ nested: { b: 2 } }])).toBe('{"nested":{"b":2}} object');
            expect(helper.formatMessage('appended', [{ a: 1 }])).toBe('appended {"a":1}');
        });

        // Documented deviation: util.format throws here, and a logger should not take down its caller.
        it('should fall back to String() when %j cannot serialize the value', () => {
            expect(() => nodeFormat('%j', BigInt(1))).toThrow('Do not know how to serialize a BigInt');
            expect(helper.formatMessage('%j value', [BigInt(1)])).toBe('1 value');
        });

        it('should survive a circular object instead of throwing', () => {
            const circular: any = { name: 'loop' };
            circular.self = circular;

            expect(helper.formatMessage('circular %s', [circular])).toBe('circular [object Object]');
        });

        it('should keep the message unchanged when there are no params', () => {
            expect(helper.formatMessage('nothing to do', [])).toBe('nothing to do');
        });
    });

    describe('getColorAsType', () => {
        it('should return a color for each log type', () => {
            expect(helper.getColorAsType(LogType.INFO)).toBeDefined();
            expect(helper.getColorAsType(LogType.ERROR)).toBeDefined();
        });
    });
});
