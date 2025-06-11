import { RefreshableWebCore, TokenManager, TokenManagerConfig, TokenManagerEvents, TokenManagerStatus } from '../types/token-manager';
import { LoggerService } from '../utils';

export class LemonTokenManager implements TokenManager {
    private logger: LoggerService;

    private abortController: AbortController | null = null;
    private refreshTimer: NodeJS.Timeout | null = null;
    private status: TokenManagerStatus = 'idle';
    private retryAttempt: number = 0;
    private isDestroyed: boolean = false;

    private readonly isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';
    private isOnline: boolean = this.isBrowser ? navigator.onLine : true;

    private readonly config: Required<TokenManagerConfig>;
    private readonly events: TokenManagerEvents;
    private readonly webCore: RefreshableWebCore;

    constructor(webCore: RefreshableWebCore, config?: TokenManagerConfig, events?: TokenManagerEvents) {
        this.logger = new LoggerService('TokenManager');
        this.webCore = webCore;
        this.config = {
            refreshBufferTime: 5 * 60 * 1000,
            maxRetryAttempts: 3,
            baseRetryDelay: 30 * 1000,
            enableLogging: true,
            autoStart: true,
            ...config,
        };
        this.events = events || {};
    }

    private log(level: 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
        if (this.config.enableLogging) {
            this.logger[level](message, ...args);
        }
    }

    private setStatus(status: TokenManagerStatus): void {
        if (this.status !== status && !this.isDestroyed) {
            this.status = status;
            this.events.onStatusChanged?.(status);
            this.log('info', `Status: ${status}`);
        }
    }

    private checkDestroyed(): void {
        if (this.isDestroyed) {
            throw new Error('TokenManager has been destroyed');
        }
    }

    getStatus(): TokenManagerStatus {
        return this.status;
    }

    isRunning(): boolean {
        return !this.isDestroyed && this.status !== 'stopped';
    }

    async start(): Promise<void> {
        this.checkDestroyed();

        if (this.isRunning()) {
            this.log('warn', 'Already running');
            return;
        }

        this.log('info', 'Starting...');
        this.retryAttempt = 0;
        this.abortController = new AbortController();
        this.setStatus('idle');

        try {
            const isAuthenticated = await this.webCore.isAuthenticated();
            if (!isAuthenticated) {
                this.log('warn', 'Not authenticated');
                return;
            }

            await this.performTokenCheck();
            this.scheduleNextCheck();
            this.setupNetworkMonitoring();

            this.log('info', 'Started successfully');
        } catch (error) {
            this.log('error', 'Start failed:', error);
            this.handleError(error as Error);
        }
    }

    stop(): void {
        if (this.isDestroyed) {
            return;
        }

        this.log('info', 'Stopping...');
        this.setStatus('stopped');
        this.cleanup();
    }

    destroy(): void {
        if (this.isDestroyed) {
            return;
        }

        this.log('info', 'Destroying...');
        this.isDestroyed = true;
        this.cleanup();
    }

    private cleanup(): void {
        this.abortController?.abort();
        this.abortController = null;

        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    async forceRefresh(): Promise<boolean> {
        this.checkDestroyed();

        try {
            this.setStatus('checking');
            const shouldRefresh = await this.webCore.getTokenStorage().shouldRefreshToken();

            if (shouldRefresh) {
                await this.executeRefresh();
                return true;
            }

            this.setStatus('idle');
            return false;
        } catch (error) {
            this.handleError(error as Error);
            return false;
        }
    }

    private async executeRefresh(): Promise<void> {
        this.setStatus('refreshing');

        try {
            await this.webCore.refreshCachedToken();
            this.retryAttempt = 0; // 성공시 재시도 카운터 리셋
            this.setStatus('idle');
            this.events.onTokenRefreshed?.();
            this.log('info', 'Token refreshed successfully');
        } catch (error) {
            this.log('error', 'Token refresh failed:', error);
            throw error;
        }
    }

    private async performTokenCheck(): Promise<void> {
        if (this.abortController?.signal.aborted) {
            return;
        }

        try {
            this.setStatus('checking');

            const shouldRefresh = await this.webCore.getTokenStorage().shouldRefreshToken();
            if (shouldRefresh && !this.abortController?.signal.aborted) {
                await this.executeRefresh();
            } else {
                this.setStatus('idle');
            }
        } catch (error) {
            this.handleError(error as Error);
        }
    }

    private handleError(error: Error): void {
        this.retryAttempt++;
        this.events.onRefreshFailed?.(error, this.retryAttempt);

        if (this.retryAttempt >= this.config.maxRetryAttempts) {
            this.log('error', `Max retry attempts (${this.config.maxRetryAttempts}) reached`);
            this.setStatus('error');
            this.retryAttempt = 0; // 리셋하여 다음 주기에서 다시 시도
        } else {
            this.setStatus('retrying');
            this.log('warn', `Retry attempt ${this.retryAttempt}/${this.config.maxRetryAttempts}`);
        }
    }

    private calculateRetryDelay(): number {
        // 지수 백오프: 30s -> 60s -> 120s
        return this.config.baseRetryDelay * Math.pow(2, this.retryAttempt - 1);
    }

    private async getNextCheckInterval(): Promise<number> {
        if (this.status === 'retrying') {
            return this.calculateRetryDelay();
        }

        try {
            const tokenStorage = this.webCore.getTokenStorage();
            const expiredTime = +((await tokenStorage.getItem(`expired_time`)) || '0');

            if (!expiredTime) {
                return 60 * 1000; // 1분 기본값
            }

            const now = Date.now();
            const timeUntilExpiry = expiredTime - now;
            const timeUntilRefresh = timeUntilExpiry - this.config.refreshBufferTime;

            if (timeUntilRefresh <= 0) {
                return 30 * 1000; // 즉시 체크
            }

            // 적절한 체크 간격: 남은 시간의 1/3, 최소 30초, 최대 5분
            const checkInterval = Math.max(Math.min(timeUntilRefresh / 3, 5 * 60 * 1000), 30 * 1000);

            this.log('info', `Next check in ${Math.round(checkInterval / 1000)}s`);
            return checkInterval;
        } catch (error) {
            this.log('error', 'Error calculating check interval:', error);
            return 60 * 1000;
        }
    }

    private scheduleNextCheck(): void {
        if (!this.isRunning() || this.abortController?.signal.aborted) {
            return;
        }

        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        // async 함수를 동기적으로 처리하지 않고 Promise로 처리
        this.getNextCheckInterval()
            .then(interval => {
                if (!this.isRunning() || this.abortController?.signal.aborted) {
                    return;
                }

                this.refreshTimer = setTimeout(async () => {
                    if (!this.isRunning() || this.abortController?.signal.aborted) {
                        return;
                    }

                    // 오프라인 체크
                    if (this.isBrowser && !this.isOnline) {
                        this.log('info', 'Offline, skipping check');
                        this.scheduleNextCheck();
                        return;
                    }

                    await this.performTokenCheck();

                    // 성공 또는 최대 재시도 후에만 다음 스케줄링
                    if (this.status === 'idle' || this.retryAttempt === 0) {
                        this.scheduleNextCheck();
                    }
                }, interval);
            })
            .catch(error => {
                this.log('error', 'Failed to schedule next check:', error);
                // 실패시 기본 간격으로 재스케줄링
                if (this.isRunning()) {
                    this.refreshTimer = setTimeout(() => this.scheduleNextCheck(), 60 * 1000);
                }
            });
    }

    private setupNetworkMonitoring(): void {
        if (!this.isBrowser) {
            return;
        }

        const handleOnline = async () => {
            this.log('info', 'Network recovered');
            this.isOnline = true;
            this.events.onNetworkRecovered?.();

            // 네트워크 복구시 즉시 토큰 체크
            if (this.isRunning()) {
                await this.performTokenCheck();
            }
        };

        const handleOffline = () => {
            this.log('warn', 'Network lost');
            this.isOnline = false;
        };

        this.abortController?.signal.addEventListener('abort', () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        });

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
    }
}
