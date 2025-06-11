import { RefreshableWebCore, TokenManager, TokenManagerConfig, TokenManagerEvents, TokenManagerStatus } from '../types/token-manager';
import { LoggerService } from '../utils';

export class LemonTokenManager implements TokenManager {
    private logger: LoggerService;

    private status: TokenManagerStatus = 'stopped';
    private abortController: AbortController | null = null;
    private refreshTimer: NodeJS.Timeout | null = null;
    private retryAttempt: number = 0;

    private readonly isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';
    private isOnline: boolean = this.isBrowser ? navigator.onLine : true;
    private networkCleanup: (() => void) | null = null;

    private readonly config: Required<TokenManagerConfig>;
    private readonly events: TokenManagerEvents;
    private readonly webCore: RefreshableWebCore;

    constructor(webCore: RefreshableWebCore, config?: TokenManagerConfig, events?: TokenManagerEvents) {
        this.logger = new LoggerService('TokenManager');
        this.webCore = webCore;
        this.config = {
            refreshBufferTime: 1 * 60 * 1000, // 1분
            maxRetryAttempts: 3,
            baseRetryDelay: 30 * 1000, // 30초
            enableLogging: false,
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

    getStatus(): TokenManagerStatus {
        return this.status;
    }

    isRunning(): boolean {
        return this.status === 'running' || this.status === 'refreshing' || this.status === 'retrying';
    }

    canStart(): boolean {
        return this.status === 'stopped' || this.status === 'error';
    }

    private isDestroyed(): boolean {
        return this.status === 'destroyed';
    }

    private setStatus(newStatus: TokenManagerStatus): void {
        const validTransitions: Record<TokenManagerStatus, TokenManagerStatus[]> = {
            stopped: ['starting', 'destroyed'],
            starting: ['running', 'stopped', 'error'],
            running: ['refreshing', 'stopped', 'destroyed'],
            refreshing: ['running', 'retrying', 'error', 'stopped'],
            retrying: ['refreshing', 'error', 'stopped'],
            error: ['starting', 'destroyed'], // 재시작 가능
            destroyed: [], // 비가역적
        };

        if (this.status !== newStatus) {
            const validNext = validTransitions[this.status] || [];
            if (!validNext.includes(newStatus)) {
                this.log('warn', `Invalid state transition: ${this.status} -> ${newStatus}`);
                return;
            }

            this.status = newStatus;
            this.events.onStatusChanged?.(newStatus);
            this.log('info', `Status: ${newStatus}`);
        }
    }

    // ======================
    // 생명주기 관리
    // ======================

    async start(): Promise<void> {
        if (this.isDestroyed()) {
            throw new Error('Cannot start destroyed TokenManager');
        }

        if (!this.canStart()) {
            this.log('warn', `Cannot start from status: ${this.status}`);
            return;
        }

        this.log('info', 'Starting TokenManager...');
        this.setStatus('starting');
        this.retryAttempt = 0;
        this.abortController = new AbortController();

        try {
            // 인증 상태 확인
            const isAuthenticated = await this.webCore.isAuthenticated();
            if (!isAuthenticated) {
                this.log('warn', 'Not authenticated, stopping');
                this.setStatus('stopped');
                return;
            }

            // 정상 동작 상태로 전환
            this.setStatus('running');

            // 초기 토큰 체크
            await this.performTokenCheck();

            // 스케줄링 시작
            this.scheduleNextCheck();

            // 네트워크 모니터링 설정
            this.setupNetworkMonitoring();

            this.log('info', 'Started successfully');
        } catch (error) {
            this.log('error', 'Start failed:', error);
            this.setStatus('error');
            this.cleanup();
            throw error;
        }
    }

    stop(): void {
        if (this.isDestroyed()) {
            return;
        }

        this.log('info', 'Stopping TokenManager...');
        this.setStatus('stopped');
        this.cleanup();
    }

    destroy(): void {
        if (this.isDestroyed()) {
            return;
        }

        this.log('info', 'Destroying TokenManager...');
        this.setStatus('destroyed');
        this.cleanup();
    }

    private cleanup(): void {
        // 진행 중인 비동기 작업 취소
        this.abortController?.abort();
        this.abortController = null;

        // 타이머 정리
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        // 네트워크 모니터링 정리
        this.cleanupNetworkMonitoring();
    }

    // ======================
    // 토큰 관리 로직
    // ======================

    async forceRefresh(): Promise<boolean> {
        if (this.isDestroyed()) {
            throw new Error('Cannot refresh on destroyed TokenManager');
        }

        try {
            this.log('info', 'Force refresh requested');

            const shouldRefresh = await this.webCore.getTokenStorage().shouldRefreshToken();
            if (!shouldRefresh) {
                this.log('info', 'Token does not need refresh');
                return false;
            }

            const previousStatus = this.status;
            this.setStatus('refreshing');

            await this.executeRefresh();

            // 이전 상태가 error였다면 running으로, 아니면 이전 상태로
            this.setStatus(previousStatus === 'error' ? 'running' : previousStatus);

            return true;
        } catch (error) {
            this.log('error', 'Force refresh failed:', error);
            this.handleError(error as Error);
            return false;
        }
    }

    private async performTokenCheck(): Promise<void> {
        if (!this.isRunning() || this.abortController?.signal.aborted) {
            return;
        }

        try {
            this.setStatus('refreshing');

            const shouldRefresh = await this.webCore.getTokenStorage().shouldRefreshToken();

            if (shouldRefresh && this.isRunning() && !this.abortController?.signal.aborted) {
                await this.executeRefresh();
            }

            // 성공시 상태 복원 및 재시도 카운터 리셋
            this.setStatus('running');
            this.retryAttempt = 0;
        } catch (error) {
            this.log('error', 'Token check failed:', error);
            this.handleError(error as Error);
        }
    }

    private async executeRefresh(): Promise<void> {
        this.log('info', 'Executing token refresh...');

        try {
            await this.webCore.refreshCachedToken();
            this.events.onTokenRefreshed?.();
            this.log('info', 'Token refreshed successfully');
        } catch (error) {
            this.log('error', 'Token refresh execution failed:', error);
            throw error;
        }
    }

    private handleError(error: Error): void {
        this.retryAttempt++;
        this.events.onRefreshFailed?.(error, this.retryAttempt);

        if (this.retryAttempt >= this.config.maxRetryAttempts) {
            this.log('error', `Max retry attempts (${this.config.maxRetryAttempts}) reached`);
            this.setStatus('error');
            this.cleanup(); // 복구 불가능한 상태에서는 리소스 정리
        } else {
            this.log('warn', `Retry attempt ${this.retryAttempt}/${this.config.maxRetryAttempts}`);
            this.setStatus('retrying');
        }
    }

    // ======================
    // 스케줄링 로직
    // ======================

    private scheduleNextCheck(): void {
        if (!this.isRunning() || this.abortController?.signal.aborted) {
            return;
        }

        // 기존 타이머 정리
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        // 다음 체크 간격 계산
        this.getNextCheckInterval()
            .then(interval => {
                if (!this.isRunning() || this.abortController?.signal.aborted) {
                    return;
                }

                this.refreshTimer = setTimeout(async () => {
                    if (!this.isRunning() || this.abortController?.signal.aborted) {
                        return;
                    }

                    // 오프라인 상태 체크
                    if (this.isBrowser && !this.isOnline) {
                        this.log('info', 'Offline, skipping check');
                        this.scheduleNextCheck();
                        return;
                    }

                    // 토큰 체크 수행
                    await this.performTokenCheck();

                    // 성공하거나 최대 재시도 후에만 다음 스케줄링
                    if (this.status === 'running' || this.retryAttempt === 0) {
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

    private async getNextCheckInterval(): Promise<number> {
        // 재시도 상태에서는 지수 백오프 적용
        if (this.status === 'retrying') {
            const retryDelay = this.config.baseRetryDelay * Math.pow(2, this.retryAttempt - 1);
            this.log('info', `Next retry in ${Math.round(retryDelay / 1000)}s`);
            return retryDelay;
        }

        try {
            const tokenStorage = this.webCore.getTokenStorage();
            const expiredTime = +((await tokenStorage.getItem('expired_time')) || '0');

            if (!expiredTime) {
                return 60 * 1000; // 1분 기본값
            }

            const now = Date.now();
            const timeUntilExpiry = expiredTime - now;
            const timeUntilRefresh = timeUntilExpiry - this.config.refreshBufferTime;

            if (timeUntilRefresh <= 0) {
                return 30 * 1000; // 즉시 체크 (30초 최소 간격)
            }

            // 적절한 체크 간격: 남은 시간의 1/3, 최소 30초, 최대 5분
            const checkInterval = Math.max(Math.min(timeUntilRefresh / 3, 5 * 60 * 1000), 30 * 1000);

            this.log('info', `Next check in ${Math.round(checkInterval / 1000)}s (expires in ${Math.round(timeUntilExpiry / 1000)}s)`);
            return checkInterval;
        } catch (error) {
            this.log('error', 'Error calculating check interval:', error);
            return 60 * 1000; // 기본 1분
        }
    }

    // ======================
    // 네트워크 모니터링
    // ======================

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

        // 이벤트 리스너 등록
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // 정리 함수 저장
        this.networkCleanup = () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }

    private cleanupNetworkMonitoring(): void {
        this.networkCleanup?.();
        this.networkCleanup = null;
    }
}
