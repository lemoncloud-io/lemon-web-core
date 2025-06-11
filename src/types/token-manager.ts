import { TokenStorageService } from '../token-storage';

export interface TokenManager {
    start(): Promise<void>;
    stop(): void;
    forceRefresh(): Promise<boolean>;
    getStatus(): TokenManagerStatus;
    isRunning(): boolean;
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

export type TokenManagerStatus = 'idle' | 'checking' | 'refreshing' | 'stopped' | 'error' | 'retrying';
