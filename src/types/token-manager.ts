import { TokenStorageService } from '../token-storage';

export interface TokenManager {
    start(): Promise<void>;
    stop(): void;
    destroy(): void;
    forceRefresh(): Promise<boolean>;
    getStatus(): TokenManagerStatus;
    isRunning(): boolean;
    canStart(): boolean;
}

export interface TokenStorage {
    shouldRefreshToken(): Promise<boolean>;
    getItem(key: string): Promise<string | null>;
    prefix: string;
}

export interface RefreshableWebCore {
    refreshCachedToken(): Promise<any>;
    getTokenStorage(): TokenStorageService;
    isAuthenticated(): Promise<boolean>;
}

export interface TokenManagerConfig {
    refreshBufferTime?: number;
    maxRetryAttempts?: number;
    baseRetryDelay?: number;
    enableLogging?: boolean;
    autoStart?: boolean;
}

export interface TokenManagerEvents {
    onTokenRefreshed?: () => void;
    onTokenExpired?: () => void;
    onRefreshFailed?: (error: Error, attempt: number) => void;
    onNetworkRecovered?: () => void;
    onStatusChanged?: (status: TokenManagerStatus) => void;
}

export type TokenManagerStatus =
    | 'stopped' // 완전 중지, 재시작 가능
    | 'starting' // 초기화 중
    | 'running' // 정상 동작 (idle 대기 포함)
    | 'refreshing' // 토큰 갱신 중
    | 'retrying' // 재시도 중
    | 'error' // 복구 불가능한 오류
    | 'destroyed'; // 완전 파괴됨
