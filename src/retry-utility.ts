import { RetryConfig } from './types';
import { ErrorHandler } from './error-handler';
import { Logger } from './logger';

/**
 * Retry utility with exponential backoff for API requests
 * Implements intelligent retry logic with configurable parameters
 */
export class RetryUtility {
	private static readonly DEFAULT_CONFIG: RetryConfig = {
		maxRetries: 3,
		baseDelay: 1000, // 1 second
		maxDelay: 30000, // 30 seconds
		backoffMultiplier: 2
	};

	/**
	 * Execute a function with retry logic and exponential backoff
	 */
	static async executeWithRetry<T>(
		operation: () => Promise<T>,
		config: Partial<RetryConfig> = {},
		context: string = 'API request',
		logger?: Logger
	): Promise<T> {
		const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
		let lastError: unknown;

		for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
			try {
				// Check if we're online before attempting
				if (!ErrorHandler.isOnline()) {
					throw ErrorHandler.createApiError(
						'System is offline',
						0,
						'OFFLINE',
						false
					);
				}

				const result = await operation();

				// Log successful retry if this wasn't the first attempt
				if (attempt > 0 && logger) {
					logger.debug(`${context} succeeded after ${attempt} retries`);
				}

				return result;
			} catch (error) {
				lastError = error;

				// Don't retry if this is the last attempt
				if (attempt === finalConfig.maxRetries) {
					break;
				}

				// Check if error is retryable
				if (!ErrorHandler.isRetryableError(error)) {
					if (logger) {
						logger.debug(`${context} failed with non-retryable error, not retrying`);
					}
					break;
				}

				// Calculate delay for next attempt
				const delay = this.calculateDelay(attempt, finalConfig, error);

				if (logger) {
					logger.debug(
						`${context} failed (attempt ${attempt + 1}/${finalConfig.maxRetries + 1}), ` +
						`retrying in ${delay}ms. Error: ${error instanceof Error ? error.message : String(error)}`
					);
				}

				// Wait before retrying
				await this.sleep(delay);
			}
		}

		// All retries exhausted, throw the last error
		ErrorHandler.logDetailedError(lastError, `${context} - All retries exhausted`, {
			maxRetries: finalConfig.maxRetries,
			config: finalConfig
		}, logger);

		throw lastError;
	}

	/**
	 * Calculate delay for next retry attempt using exponential backoff
	 */
	private static calculateDelay(attempt: number, config: RetryConfig, error: unknown): number {
		// Check if error specifies a retry delay (e.g., from Retry-After header)
		const errorRetryDelay = ErrorHandler.getRetryDelay(error);
		if (errorRetryDelay) {
			return Math.min(errorRetryDelay * 1000, config.maxDelay); // Convert to milliseconds
		}

		// Calculate exponential backoff delay
		const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);

		// Add jitter to prevent thundering herd problem
		const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter

		const totalDelay = exponentialDelay + jitter;

		// Cap at maximum delay
		return Math.min(totalDelay, config.maxDelay);
	}

	/**
	 * Sleep for specified milliseconds
	 */
	private static sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Create a retry wrapper for a function
	 */
	static createRetryWrapper<T extends any[], R>(
		fn: (...args: T) => Promise<R>,
		config: Partial<RetryConfig> = {},
		context: string = 'Operation',
		logger?: Logger
	): (...args: T) => Promise<R> {
		return async (...args: T): Promise<R> => {
			return this.executeWithRetry(
				() => fn(...args),
				config,
				context,
				logger
			);
		};
	}

	/**
	 * Batch retry operations with controlled concurrency
	 */
	static async batchWithRetry<T, R>(
		items: T[],
		operation: (item: T) => Promise<R>,
		config: Partial<RetryConfig> = {},
		maxConcurrency: number = 3,
		context: string = 'Batch operation',
		logger?: Logger
	): Promise<{ successful: R[]; failed: { item: T; error: unknown }[] }> {
		const successful: R[] = [];
		const failed: { item: T; error: unknown }[] = [];

		// Process items in batches to control concurrency
		for (let i = 0; i < items.length; i += maxConcurrency) {
			const batch = items.slice(i, i + maxConcurrency);

			const batchPromises = batch.map(async (item) => {
				try {
					const result = await this.executeWithRetry(
						() => operation(item),
						config,
						`${context} - Item ${i + batch.indexOf(item) + 1}`,
						logger
					);
					return { success: true, result, item };
				} catch (error) {
					return { success: false, error, item };
				}
			});

			const batchResults = await Promise.all(batchPromises);

			// Categorize results
			for (const result of batchResults) {
				if (result.success) {
					successful.push(result.result);
				} else {
					failed.push({ item: result.item, error: result.error });
				}
			}
		}

		return { successful, failed };
	}

	/**
	 * Create a circuit breaker pattern for repeated failures
	 */
	static createCircuitBreaker<T extends any[], R>(
		fn: (...args: T) => Promise<R>,
		failureThreshold: number = 5,
		resetTimeout: number = 60000, // 1 minute
		context: string = 'Circuit breaker operation',
		logger?: Logger
	): (...args: T) => Promise<R> {
		let failureCount = 0;
		let lastFailureTime = 0;
		let isOpen = false;

		return async (...args: T): Promise<R> => {
			const now = Date.now();

			// Check if circuit should be reset
			if (isOpen && now - lastFailureTime > resetTimeout) {
				if (logger) {
					logger.debug(`Circuit breaker reset for ${context}`);
				}
				isOpen = false;
				failureCount = 0;
			}

			// If circuit is open, fail fast
			if (isOpen) {
				throw ErrorHandler.createApiError(
					`Circuit breaker is open for ${context}`,
					503,
					'CIRCUIT_BREAKER_OPEN',
					false
				);
			}

			try {
				const result = await fn(...args);

				// Reset failure count on success
				if (failureCount > 0 && logger) {
					logger.debug(`Circuit breaker success, resetting failure count for ${context}`);
					failureCount = 0;
				}

				return result;
			} catch (error) {
				failureCount++;
				lastFailureTime = now;

				if (logger) {
					logger.debug(`Circuit breaker failure ${failureCount}/${failureThreshold} for ${context}`);
				}

				// Open circuit if threshold reached
				if (failureCount >= failureThreshold) {
					isOpen = true;
					if (logger) {
						logger.debug(`Circuit breaker opened for ${context}`);
					}
				}

				throw error;
			}
		};
	}
}