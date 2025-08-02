import { Notice } from 'obsidian';
import { JoplinApiError, UserFriendlyError } from './types';

/**
 * Comprehensive error handling utility for Joplin Portal plugin
 * Provides user-friendly error messages, logging, and error categorization
 */
export class ErrorHandler {
	private static readonly ERROR_CATEGORIES = {
		NETWORK: 'network',
		AUTHENTICATION: 'authentication',
		API: 'api',
		RATE_LIMIT: 'rate_limit',
		IMPORT: 'import',
		CONFIGURATION: 'configuration',
		UNKNOWN: 'unknown'
	} as const;

	/**
	 * Handle API errors and convert to user-friendly format
	 */
	static handleApiError(error: unknown, context: string = ''): UserFriendlyError {
		const logPrefix = 'Joplin Portal Error Handler';

		// Log the original error for debugging
		console.error(`${logPrefix}: ${context}`, error);

		if (error instanceof Error && 'status' in error) {
			const apiError = error as JoplinApiError;
			return this.handleHttpError(apiError, context);
		}

		if (error instanceof Error) {
			return this.handleGenericError(error, context);
		}

		// Unknown error type
		return {
			message: 'An unexpected error occurred',
			details: context ? `Context: ${context}` : undefined,
			action: 'Please try again or check your connection settings',
			severity: 'error'
		};
	}

	/**
	 * Handle HTTP-specific errors
	 */
	private static handleHttpError(error: JoplinApiError, context: string): UserFriendlyError {
		const status = error.status || 0;

		switch (true) {
			case status === 0:
				return {
					message: 'Unable to connect to Joplin server',
					details: 'The server may be offline or the URL may be incorrect',
					action: 'Check your server URL and ensure Joplin is running with Web Clipper enabled',
					severity: 'error'
				};

			case status === 401:
				return {
					message: 'Authentication failed',
					details: 'Invalid API token or token has expired',
					action: 'Please check your API token in the plugin settings',
					severity: 'error'
				};

			case status === 403:
				return {
					message: 'Access denied',
					details: 'The API token does not have sufficient permissions',
					action: 'Please verify your API token has the required permissions',
					severity: 'error'
				};

			case status === 404:
				return {
					message: 'Resource not found',
					details: context.includes('note') ? 'The requested note may have been deleted' : 'The requested resource was not found',
					action: 'Try refreshing your search results',
					severity: 'warning'
				};

			case status === 429:
				return {
					message: 'Too many requests',
					details: 'You are making requests too quickly',
					action: 'Please wait a moment before trying again',
					severity: 'warning'
				};

			case status >= 500:
				return {
					message: 'Joplin server error',
					details: `Server returned error ${status}`,
					action: 'The server may be experiencing issues. Please try again later',
					severity: 'error'
				};

			case status >= 400:
				return {
					message: 'Request failed',
					details: `HTTP ${status}: ${error.message}`,
					action: 'Please check your request and try again',
					severity: 'error'
				};

			default:
				return {
					message: 'Network error occurred',
					details: error.message,
					action: 'Please check your connection and try again',
					severity: 'error'
				};
		}
	}

	/**
	 * Handle generic JavaScript errors
	 */
	private static handleGenericError(error: Error, context: string): UserFriendlyError {
		// Check for common network error patterns
		if (this.isNetworkError(error)) {
			return {
				message: 'Network connection failed',
				details: 'Unable to reach the Joplin server',
				action: 'Check your internet connection and server settings',
				severity: 'error'
			};
		}

		// Check for timeout errors
		if (this.isTimeoutError(error)) {
			return {
				message: 'Request timed out',
				details: 'The server took too long to respond',
				action: 'The server may be slow. Please try again',
				severity: 'warning'
			};
		}

		// Generic error handling
		return {
			message: 'An error occurred',
			details: error.message,
			action: 'Please try again or contact support if the problem persists',
			severity: 'error'
		};
	}

	/**
	 * Handle import-specific errors
	 */
	static handleImportError(error: unknown, noteTitle: string = 'Unknown'): UserFriendlyError {
		console.error('Joplin Portal Import Error:', error);

		if (error instanceof Error) {
			// Check for file system errors
			if (error.message.includes('already exists')) {
				return {
					message: `Import skipped: "${noteTitle}"`,
					details: 'A file with this name already exists',
					action: 'Choose a different conflict resolution option',
					severity: 'warning'
				};
			}

			if (error.message.includes('permission') || error.message.includes('EACCES')) {
				return {
					message: `Permission denied importing "${noteTitle}"`,
					details: 'Unable to write to the target folder',
					action: 'Check folder permissions or choose a different target folder',
					severity: 'error'
				};
			}

			if (error.message.includes('ENOSPC')) {
				return {
					message: 'Not enough disk space',
					details: 'Unable to create the imported file',
					action: 'Free up disk space and try again',
					severity: 'error'
				};
			}
		}

		return {
			message: `Failed to import "${noteTitle}"`,
			details: error instanceof Error ? error.message : 'Unknown error',
			action: 'Please try again or check the file content',
			severity: 'error'
		};
	}

	/**
	 * Show user-friendly error notice
	 */
	static showErrorNotice(error: UserFriendlyError, duration: number = 8000): void {
		const severityIcon = this.getSeverityIcon(error.severity || 'error');
		let message = `${severityIcon} ${error.message}`;

		if (error.details) {
			message += `\n${error.details}`;
		}

		if (error.action) {
			message += `\n💡 ${error.action}`;
		}

		new Notice(message, duration);
	}

	/**
	 * Log detailed error information for debugging
	 */
	static logDetailedError(error: unknown, context: string, additionalInfo?: Record<string, any>): void {
		const timestamp = new Date().toISOString();
		const logEntry = {
			timestamp,
			context,
			error: {
				name: error instanceof Error ? error.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				...(error instanceof Error && 'status' in error ? { status: (error as JoplinApiError).status } : {}),
				...(error instanceof Error && 'code' in error ? { code: (error as JoplinApiError).code } : {})
			},
			additionalInfo
		};

		console.error('Joplin Portal Detailed Error:', logEntry);

		// In a production environment, you might want to send this to a logging service
		// this.sendToLoggingService(logEntry);
	}

	/**
	 * Check if error is network-related
	 */
	private static isNetworkError(error: Error): boolean {
		const networkErrorPatterns = [
			'network error',
			'connection failed',
			'connection refused',
			'connection timeout',
			'dns',
			'enotfound',
			'econnrefused',
			'econnreset',
			'etimedout'
		];

		const errorMessage = error.message.toLowerCase();
		return networkErrorPatterns.some(pattern => errorMessage.includes(pattern));
	}

	/**
	 * Check if error is timeout-related
	 */
	private static isTimeoutError(error: Error): boolean {
		const timeoutPatterns = [
			'timeout',
			'timed out',
			'etimedout',
			'request timeout'
		];

		const errorMessage = error.message.toLowerCase();
		return timeoutPatterns.some(pattern => errorMessage.includes(pattern));
	}

	/**
	 * Get icon for error severity
	 */
	private static getSeverityIcon(severity: string): string {
		switch (severity) {
			case 'info':
				return 'ℹ️';
			case 'warning':
				return '⚠️';
			case 'error':
				return '❌';
			case 'critical':
				return '🚨';
			default:
				return '❌';
		}
	}

	/**
	 * Create a standardized API error
	 */
	static createApiError(
		message: string,
		status?: number,
		code?: string,
		retryable: boolean = false,
		retryAfter?: number
	): JoplinApiError {
		const error = new Error(message) as JoplinApiError;
		error.name = 'JoplinApiError';
		error.status = status;
		error.code = code;
		error.retryable = retryable;
		error.retryAfter = retryAfter;
		return error;
	}

	/**
	 * Determine if an error is retryable
	 */
	static isRetryableError(error: unknown): boolean {
		if (error instanceof Error && 'retryable' in error) {
			return (error as JoplinApiError).retryable === true;
		}

		if (error instanceof Error && 'status' in error) {
			const status = (error as JoplinApiError).status;
			// Retry on server errors, timeouts, and rate limits
			return status === 429 || status === 503 || status === 502 || status === 504 || status === 0;
		}

		// Retry on network errors
		if (error instanceof Error) {
			return this.isNetworkError(error) || this.isTimeoutError(error);
		}

		return false;
	}

	/**
	 * Get retry delay from error (for rate limiting)
	 */
	static getRetryDelay(error: unknown): number | undefined {
		if (error instanceof Error && 'retryAfter' in error) {
			return (error as JoplinApiError).retryAfter;
		}
		return undefined;
	}

	/**
	 * Check if the system is online
	 */
	static isOnline(): boolean {
		return navigator.onLine;
	}

	/**
	 * Create offline error
	 */
	static createOfflineError(): UserFriendlyError {
		return {
			message: 'You are currently offline',
			details: 'Internet connection is required to access Joplin server',
			action: 'Please check your internet connection and try again',
			severity: 'warning'
		};
	}
}