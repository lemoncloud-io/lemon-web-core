import { LogType } from './logger.service';

export const NODE_COLORS = {
    Black: 0,
    Red: 1,
    Green: 2,
    Yellow: 3,
    Blue: 4,
    Magenta: 5,
    Cyan: 6,
    Grey: 7,
    White: 9,
};

export const BROWSER_COLORS = {
    Black: 'Black',
    Red: 'IndianRed',
    Green: 'LimeGreen',
    Yellow: 'Orange',
    Blue: 'RoyalBlue',
    Magenta: 'Orchid',
    Cyan: 'SkyBlue',
    Grey: 'DimGrey',
    White: 'White',
};

const PLACEHOLDER = /%([sdifjoO%])/g;

const jsonify = (value: unknown): string => {
    try {
        return String(JSON.stringify(value));
    } catch (error) {
        // A circular structure is the case util.format also renders rather than throws.
        return error instanceof TypeError && error.message.includes('circular') ? '[Circular]' : String(value);
    }
};

const stringify = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'bigint') {
        return `${value}n`;
    }
    // String(-0) is '0'; util.format keeps the sign.
    if (typeof value === 'number') {
        return Object.is(value, -0) ? '-0' : String(value);
    }
    if (value instanceof Error) {
        return value.stack || value.message;
    }
    if (typeof value === 'object' && value !== null) {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
};

/**
 * printf-style formatting, replacing Node's `util.format`.
 * `util` is a Node builtin, and importing it at the top level of a browser library leaves the
 * bundler to shim it. Only the subset the logger uses is implemented: the `%s %d %i %f %j %o %O %%`
 * placeholders, with unconsumed arguments appended space-separated.
 *
 * Two deliberate deviations from `util.format`, both asserted in the spec:
 *
 * 1. Objects render as JSON rather than through `util.inspect`, so `{ a: 1 }` prints as `{"a":1}`.
 *    Reproducing `inspect` (depth limits, circular references, class names) is not worth carrying in
 *    a browser bundle for log output. This covers `%s`, `%o`, `%O` and appended arguments.
 * 2. `%j` on a value `JSON.stringify` refuses outright, such as a bigint, falls back to `String()`.
 *    `util.format` throws there, and a logger should not be able to take down its caller.
 *
 * Everything else the spec can reach matches `util.format`, including the numeric placeholders on
 * symbols and bigints and `%j` on a circular structure.
 */
const format = (message: string, ...params: unknown[]): string => {
    // util.format leaves the message untouched when there is nothing to substitute, so `%%` only
    // collapses to `%` once at least one argument is present. Matching that keeps log output stable.
    if (params.length === 0) {
        return message;
    }

    let consumed = 0;
    const formatted = message.replace(PLACEHOLDER, (placeholder, kind: string) => {
        if (kind === '%') {
            return '%';
        }
        if (consumed >= params.length) {
            return placeholder;
        }
        const value = params[consumed++];
        const isNumericPlaceholder = kind === 'd' || kind === 'i' || kind === 'f';
        if (isNumericPlaceholder) {
            // %f is the odd one out: util.format parses a bigint as a plain float, keeping no suffix.
            if (typeof value === 'bigint') {
                return kind === 'f' ? String(parseFloat(String(value))) : `${value}n`;
            }
            // Number(symbol) throws, and a logger that throws is worse than one that prints NaN.
            if (typeof value === 'symbol') {
                return 'NaN';
            }
        }

        switch (kind) {
            case 'd':
                return stringify(Number(value));
            case 'i':
                return String(parseInt(String(value), 10));
            case 'f':
                return String(parseFloat(String(value)));
            case 'j':
                return jsonify(value);
            default:
                return stringify(value);
        }
    });

    const remaining = params.slice(consumed);
    return remaining.length > 0 ? [formatted, ...remaining.map(stringify)].join(' ') : formatted;
};

export class LoggerHelperService {
    private colorSet: any;
    private logColors: any;

    constructor() {
        this.colorSet = this.getColorSet();
        this.logColors = {
            DEBUG: this.colorSet.Blue,
            INFO: this.colorSet.Green,
            WARN: this.colorSet.Yellow,
            ERROR: this.colorSet.Red,
            DEFAULT: this.colorSet.Black,
        };
    }

    public formatMessage(message: string, params: any[]) {
        const extraParams = this.checkErrorInstance(params);
        return format(message, ...extraParams);
    }

    public getColorAsType(type: LogType): string {
        return this.logColors[type];
    }

    public getColorByName(name: string = 'Grey') {
        return this.colorSet[name];
    }

    public isBrowser() {
        return typeof window !== 'undefined' && typeof window.document !== 'undefined';
    }

    public isNode() {
        return typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
    }

    private checkErrorInstance(params: any[]) {
        if (this.isNode()) {
            return params;
        }
        // isBrowser
        // browser에서 error message만 출력하는 이슈 해결 위해
        return params.map(param => {
            if (param instanceof Error) {
                return { error: param.message, stack: param.stack };
            } else {
                return param;
            }
        });
    }

    private getColorSet() {
        return this.isBrowser() ? BROWSER_COLORS : NODE_COLORS;
    }
}
