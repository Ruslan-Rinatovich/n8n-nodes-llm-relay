export interface RetryOptions {
    retries?: number;
    base?: number;
    factor?: number;
    jitter?: boolean;
    timeoutMs?: number;
}
export declare function retry<T>(fn: (signal: AbortSignal, attempt: number) => Promise<T>, { retries, base, factor, jitter, timeoutMs, }?: RetryOptions): Promise<T>;
