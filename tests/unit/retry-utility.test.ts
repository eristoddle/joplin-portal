import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryUtility } from '../../src/retry-utility';

describe('RetryUtility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const successfulOperation = vi.fn().mockResolvedValue('success');

      const result = await RetryUtility.withRetry(successfulOperation);

      expect(result).toBe('success');
      expect(successfulOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const flakyOperation = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success');

      const promise = RetryUtility.withRetry(flakyOperation, {
        maxAttempts: 3,
        baseDelay: 100
      });

      // Fast-forward through delays
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      vi.advanceTimersByTime(200);
      await Promise.resolve();

      const result = await promise;

      expect(result).toBe('success');
      expect(flakyOperation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      const promise = RetryUtility.withRetry(failingOperation, {
        maxAttempts: 2,
        baseDelay: 100
      });

      // Fast-forward through delay
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise).rejects.toThrow('Persistent failure');
      expect(failingOperation).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('Failure'));
      const delaySpy = vi.spyOn(RetryUtility, 'delay');

      const promise = RetryUtility.withRetry(failingOperation, {
        maxAttempts: 3,
        baseDelay: 100
      });

      // Fast-forward through delays
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      vi.advanceTimersByTime(200);
      await Promise.resolve();

      await expect(promise).rejects.toThrow('Failure');

      expect(delaySpy).toHaveBeenCalledWith(100); // First retry
      expect(delaySpy).toHaveBeenCalledWith(200); // Second retry
    });

    it('should respect max delay', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('Failure'));
      const delaySpy = vi.spyOn(RetryUtility, 'delay');

      const promise = RetryUtility.withRetry(failingOperation, {
        maxAttempts: 4,
        baseDelay: 1000,
        maxDelay: 2000
      });

      // Fast-forward through delays
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      vi.advanceTimersByTime(2000); // Should be capped at maxDelay
      await Promise.resolve();
      vi.advanceTimersByTime(2000); // Should be capped at maxDelay
      await Promise.resolve();

      await expect(promise).rejects.toThrow('Failure');

      expect(delaySpy).toHaveBeenCalledWith(1000); // First retry
      expect(delaySpy).toHaveBeenCalledWith(2000); // Second retry (capped)
      expect(delaySpy).toHaveBeenCalledWith(2000); // Third retry (capped)
    });

    it('should use custom shouldRetry function', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Retryable error'))
        .mockRejectedValueOnce(new Error('Non-retryable error'));

      const shouldRetry = vi.fn()
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const promise = RetryUtility.withRetry(operation, {
        maxAttempts: 3,
        baseDelay: 100,
        shouldRetry
      });

      // Fast-forward through first delay
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise).rejects.toThrow('Non-retryable error');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(shouldRetry).toHaveBeenCalledTimes(2);
    });

    it('should call onRetry callback', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success');

      const onRetry = vi.fn();

      const promise = RetryUtility.withRetry(operation, {
        maxAttempts: 2,
        baseDelay: 100,
        onRetry
      });

      // Fast-forward through delay
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      const result = await promise;

      expect(result).toBe('success');
      expect(onRetry).toHaveBeenCalledWith(new Error('First failure'), 1);
    });
  });

  describe('delay', () => {
    it('should delay for specified time', async () => {
      const promise = RetryUtility.delay(1000);

      vi.advanceTimersByTime(999);
      expect(promise).not.toEqual(expect.any(Promise));

      vi.advanceTimersByTime(1);
      await expect(promise).resolves.toBeUndefined();
    });

    it('should handle zero delay', async () => {
      const promise = RetryUtility.delay(0);
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('calculateDelay', () => {
    it('should calculate exponential backoff', () => {
      expect(RetryUtility.calculateDelay(1, 100)).toBe(100);
      expect(RetryUtility.calculateDelay(2, 100)).toBe(200);
      expect(RetryUtility.calculateDelay(3, 100)).toBe(400);
      expect(RetryUtility.calculateDelay(4, 100)).toBe(800);
    });

    it('should respect max delay', () => {
      expect(RetryUtility.calculateDelay(5, 100, 500)).toBe(500);
      expect(RetryUtility.calculateDelay(10, 100, 1000)).toBe(1000);
    });

    it('should handle edge cases', () => {
      expect(RetryUtility.calculateDelay(0, 100)).toBe(0);
      expect(RetryUtility.calculateDelay(1, 0)).toBe(0);
    });
  });

  describe('isRetryableError', () => {
    it('should identify network errors as retryable', () => {
      const networkError = { code: 'NETWORK_ERROR' };
      expect(RetryUtility.isRetryableError(networkError)).toBe(true);
    });

    it('should identify timeout errors as retryable', () => {
      const timeoutError = { code: 'TIMEOUT' };
      expect(RetryUtility.isRetryableError(timeoutError)).toBe(true);
    });

    it('should identify 5xx status codes as retryable', () => {
      const serverError = { status: 500 };
      expect(RetryUtility.isRetryableError(serverError)).toBe(true);

      const badGateway = { status: 502 };
      expect(RetryUtility.isRetryableError(badGateway)).toBe(true);
    });

    it('should not identify 4xx status codes as retryable', () => {
      const badRequest = { status: 400 };
      expect(RetryUtility.isRetryableError(badRequest)).toBe(false);

      const unauthorized = { status: 401 };
      expect(RetryUtility.isRetryableError(unauthorized)).toBe(false);

      const notFound = { status: 404 };
      expect(RetryUtility.isRetryableError(notFound)).toBe(false);
    });

    it('should handle errors without status or code', () => {
      const genericError = { message: 'Something went wrong' };
      expect(RetryUtility.isRetryableError(genericError)).toBe(false);
    });
  });
});