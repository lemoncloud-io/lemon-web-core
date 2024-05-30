// refer: https://github.com/lemoncloud-io/lemon-logger-lib
// TODO: use @lemoncloud/lemon-logger-lib
import { LoggerHelperService } from './logger-helper.service';
import { LoggerOption } from '../types';

export enum LogType {
    DEBUG = 'DEBUG',
    WARN = 'WARN',
    INFO = 'INFO',
    ERROR = 'ERROR',
}

export interface LogInterface {
    debug(message: string, ...extraParams: any[]): void;
    warn(message: string, ...extraParams: any[]): void;
    info(message: string, ...extraParams: any[]): void;
    error(message: string, ...extraParams: any[]): void;
}

export interface FormatInterface {
    timestampFormat: string;
    typeFormat: string;
    textFormat: string;
    namespaceFormat: string;
}

export class LoggerService implements LogInterface {
    private utils: LoggerHelperService;

    private isNode: boolean;
    private isBrowser: boolean;

    private namespace: string;
    private options: LoggerOption = {
        showTimestamp: true,
        showLogType: true,
    };

    constructor(namespace: string = 'LEMON', options: LoggerOption = {}) {
        this.utils = new LoggerHelperService();
        this.namespace = namespace;
        this.options = { ...this.options, ...options };

        this.isNode = this.utils.isNode();
        this.isBrowser = this.utils.isBrowser();
    }

    log(message: string, ...extraParams: any[]) {
        const formattedMessage = this.utils.formatMessage(message, extraParams);
        this.writeLog(LogType.DEBUG, formattedMessage);
        return;
    }

    debug(message: string, ...extraParams: any[]) {
        const formattedMessage = this.utils.formatMessage(message, extraParams);
        this.writeLog(LogType.DEBUG, formattedMessage);
    }

    warn(message: string, ...extraParams: any[]) {
        const formattedMessage = this.utils.formatMessage(message, extraParams);
        this.writeLog(LogType.WARN, formattedMessage);
    }

    info(message: string, ...extraParams: any[]) {
        const formattedMessage = this.utils.formatMessage(message, extraParams);
        this.writeLog(LogType.INFO, formattedMessage);
    }

    error(message: string, ...extraParams: any[]) {
        const formattedMessage = this.utils.formatMessage(message, extraParams);
        this.writeLog(LogType.ERROR, formattedMessage);
    }

    private writeLog(type: LogType, message: string) {
        const format: FormatInterface = this.getFormat(type);
        const formattedText = this.createLogMessage(type, message, format);
        if (this.isNode) {
            console.log(formattedText);
            return;
        }

        // isBrowser
        this.logOnBrowser(type, formattedText, format);
        return;
    }

    private createLogMessage(type: LogType, text: string, format: FormatInterface, shouldFormat: boolean = true) {
        const typeBlank = type === LogType.INFO || type === LogType.WARN ? ' ' : '';
        const { showTimestamp, showLogType } = this.options;
        let { timestampFormat, typeFormat, textFormat, namespaceFormat } = format;

        if (this.isBrowser && shouldFormat) {
            timestampFormat = '%c';
            typeFormat = '%c';
            namespaceFormat = '%c';
            textFormat = ': %c';
        }

        const timestampLog = showTimestamp ? `${timestampFormat}${this.createTimestamp(new Date())} ` : `${timestampFormat}`; // format 정해줘야 browser에서 포맷 안깨짐
        const typeLog = showLogType ? `${typeFormat}[${type}]${typeBlank} ` : `${typeFormat}`;
        const namespaceLog = `${namespaceFormat}${this.namespace}`;
        const textLog = `${textFormat}${text}`;
        return `${timestampLog}${typeLog}${namespaceLog}${textLog}`;
    }

    private logOnBrowser(type: LogType, message: string, format: FormatInterface) {
        const { timestampFormat, typeFormat, namespaceFormat, textFormat } = format;
        if (type === LogType.ERROR) {
            console.error(message, timestampFormat, typeFormat, namespaceFormat, textFormat);
        } else {
            console.log(message, timestampFormat, typeFormat, namespaceFormat, textFormat);
        }
    }

    private getFormat(type: LogType): FormatInterface {
        if (this.isNode) {
            return this.getNodeFormat(type);
        }
        // isBrowser
        return this.getBrowserFormat(type);
    }

    private getNodeFormat(type: LogType): FormatInterface {
        const whiteColor = this.utils.getColorByName('White');
        const typeColor = this.utils.getColorAsType(type);
        const greyColor = this.utils.getColorByName('Grey');

        const timestampFormat = '\u001b[3' + greyColor + 'm';
        const typeFormat = '\u001b[3' + typeColor + ';22m';
        const namespaceFormat = '\u001b[3' + whiteColor + ';1m';
        const textFormat = '\u001b[0m: ';

        return { timestampFormat, typeFormat, textFormat, namespaceFormat };
    }

    private getBrowserFormat(type: LogType): FormatInterface {
        const blackColor = this.utils.getColorByName('Black');
        const typeColor = this.utils.getColorAsType(type);
        const greyColor = this.utils.getColorByName('Grey');

        const timestampFormat = 'color:' + greyColor;
        const typeFormat = 'color:' + typeColor;
        const namespaceFormat = 'color:' + blackColor + '; font-weight: bold';
        const textFormat = ': ';

        return { timestampFormat, typeFormat, textFormat, namespaceFormat };
    }

    //! timestamp like 2016-12-08 13:30:44 @lemon-engine
    private createTimestamp(date: Date) {
        const zeroOrNull = (text: number) => (text < 10 ? '0' : '');
        const dt = date || new Date();
        const [year, month, day, hours, minutes, seconds] = [
            dt.getFullYear(),
            dt.getMonth() + 1,
            dt.getDate(),
            dt.getHours(),
            dt.getMinutes(),
            dt.getSeconds(),
        ];

        const dateText = `${zeroOrNull(year)}${year}-${zeroOrNull(month)}${month}-${zeroOrNull(day)}${day}`; // yyyy-mm-dd
        const hoursText = `${zeroOrNull(hours)}${hours}:${zeroOrNull(minutes)}${minutes}:${zeroOrNull(seconds)}${seconds}`; //hh:mm:ss
        return `${dateText} ${hoursText}`;
    }
}
