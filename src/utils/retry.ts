type RetryContext = {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  error: unknown;
};

type RetryOptions = {
  onRetry?: (context: RetryContext) => void | Promise<void>;
};

export async function withRetries<T>(
  operation: () => Promise<T>,
  retries: number,
  baseDelayMs: number,
  options: RetryOptions = {}
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      if (attempt > retries) {
        throw error;
      }
      const delayMs = baseDelayMs * attempt;
      await options.onRetry?.({
        attempt,
        maxAttempts: retries + 1,
        delayMs,
        error
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
