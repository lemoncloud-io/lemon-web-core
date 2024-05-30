import { format } from 'util';
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
