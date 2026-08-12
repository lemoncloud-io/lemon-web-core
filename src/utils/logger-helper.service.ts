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

const stringify = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'bigint') {
        return `${value}n`;
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
 * One deliberate deviation from `util.format`: objects render as JSON rather than through
 * `util.inspect`, so `{ a: 1 }` prints as `{"a":1}`. Reproducing `inspect` (depth limits, circular
 * references, class names) is not worth carrying in a browser bundle for log output.
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
        switch (kind) {
            case 'd':
                return typeof value === 'bigint' ? `${value}n` : String(Number(value));
            case 'i':
                return String(parseInt(String(value), 10));
            case 'f':
                return String(parseFloat(String(value)));
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
