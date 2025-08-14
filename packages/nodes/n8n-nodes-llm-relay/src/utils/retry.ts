export interface RetryOptions {
  retries?: number;
  base?: number;
  factor?: number;
  jitter?: boolean;
  timeoutMs?: number;
}

export async function retry<T>(
  fn: (signal: AbortSignal, attempt: number) => Promise<T>,
  {
    retries = 3,
    base = 300,
    factor = 2,
    jitter = true,
    timeoutMs,
  }: RetryOptions = {},
): Promise<T> {
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
    try {
      return await fn(controller.signal, attempt);
    } catch (err) {
      attempt += 1;
      if (attempt > retries) throw err;
      let delay = base * Math.pow(factor, attempt - 1);
      if (jitter) delay *= 0.5 + Math.random() / 2;
      await new Promise((res) => setTimeout(res, delay));
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
