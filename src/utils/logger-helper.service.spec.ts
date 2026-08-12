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
        ];

        it.each(equivalent)('should match util.format for %p', (message, params) => {
            expect(helper.formatMessage(message, params)).toBe(nodeFormat(message, ...params));
        });

        // Documented deviation: objects render as JSON instead of through util.inspect.
        it('should render objects as JSON rather than inspect output', () => {
            expect(helper.formatMessage('%o object', [{ nested: { b: 2 } }])).toBe('{"nested":{"b":2}} object');
            expect(helper.formatMessage('appended', [{ a: 1 }])).toBe('appended {"a":1}');
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
