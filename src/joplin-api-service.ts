import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';
import {
	JoplinNote,
	JoplinSearchResponse,
	SearchOptions,
	JoplinApiError,
	JoplinPortalSettings
} from './types';

/**
 * Service class for communicating with Joplin API
 * Handles authentication, HTTP requests, and error handling
 */
export class JoplinApiService {
	private baseUrl: string;
	private token: string;

	constructor(settings: JoplinPortalSettings) {
		this.baseUrl = settings.serverUrl.replace(/\/$/, ''); // Remove trailing slash
		this.token = settings.apiToken;
	}

	/**
	 * Update service configuration with new settings
	 */
	updateSettings(settings: JoplinPortalSettings): void {
		this.baseUrl = settings.serverUrl.replace(/\/$/, '');
		this.token = settings.apiToken;
	}

	/**
	 * Test connection to Joplin server using ping endpoint
	 * @returns Promise<boolean> - true if connection successful
	 */
	async testConnection(): Promise<boolean> {
		try {
			const response = await this.makeRequest('/ping');
			return response.status === 200;
		} catch (error) {
			console.error('Joplin Portal: Connection test failed', error);
			return false;
		}
	}

	/**
	 * Search notes using Joplin API
	 * @param query - Search query string
	 * @param options - Search options (fields, limit, etc.)
	 * @returns Promise<JoplinNote[]> - Array of matching notes
	 */
	async searchNotes(query: string, options?: SearchOptions): Promise<JoplinNote[]> {
		if (!query.trim()) {
			return [];
		}

		try {
			const params = new URLSearchParams({
				query: query.trim(),
				fields: options?.fields?.join(',') || 'id,title,body,created_time,updated_time,parent_id',
				limit: (options?.limit || 50).toString(),
				page: (options?.page || 1).toString()
			});

			if (options?.order_by) {
				params.append('order_by', options.order_by);
			}
			if (options?.order_dir) {
				params.append('order_dir', options.order_dir);
			}

			const response = await this.makeRequest(`/search?${params.toString()}`);
			const data: JoplinSearchResponse = await response.json;

			return data.items || [];
		} catch (error) {
			this.handleError(error, 'Failed to search notes');
			return [];
		}
	}

	/**
	 * Get a specific note by ID
	 * @param id - Note ID
	 * @returns Promise<JoplinNote | null> - Note data or null if not found
	 */
	async getNote(id: string): Promise<JoplinNote | null> {
		try {
			const params = new URLSearchParams({
				fields: 'id,title,body,created_time,updated_time,parent_id,source_url'
			});

			const response = await this.makeRequest(`/notes/${id}?${params.toString()}`);

			if (response.status === 404) {
				return null;
			}

			return await response.json as JoplinNote;
		} catch (error) {
			this.handleError(error, `Failed to get note with ID: ${id}`);
			return null;
		}
	}

	/**
	 * Make HTTP request to Joplin API with authentication
	 * @param endpoint - API endpoint (without base URL)
	 * @param options - Additional request options
	 * @returns Promise<RequestUrlResponse> - HTTP response
	 */
	private async makeRequest(
		endpoint: string,
		options: Partial<RequestUrlParam> = {}
	): Promise<RequestUrlResponse> {
		if (!this.token) {
			throw this.createApiError('API token is required', 401, 'MISSING_TOKEN');
		}

		const url = `${this.baseUrl}${endpoint}`;
		const separator = endpoint.includes('?') ? '&' : '?';
		const authenticatedUrl = `${url}${separator}token=${encodeURIComponent(this.token)}`;

		const requestOptions: RequestUrlParam = {
			url: authenticatedUrl,
			method: options.method || 'GET',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'Obsidian-JoplinPortal/1.0.0',
				...options.headers
			},
			...options
		};

		try {
			const response = await requestUrl(requestOptions);

			// Check for API errors
			if (response.status >= 400) {
				throw this.createApiError(
					`HTTP ${response.status}: ${response.text || 'Unknown error'}`,
					response.status,
					'HTTP_ERROR'
				);
			}

			return response;
		} catch (error) {
			if (error instanceof Error && 'status' in error) {
				// Re-throw API errors as-is
				throw error;
			}

			// Handle network/connection errors
			throw this.createApiError(
				`Network error: ${error.message || 'Connection failed'}`,
				0,
				'NETWORK_ERROR'
			);
		}
	}

	/**
	 * Create standardized API error
	 */
	private createApiError(message: string, status?: number, code?: string): JoplinApiError {
		const error = new Error(message) as JoplinApiError;
		error.name = 'JoplinApiError';
		error.status = status;
		error.code = code;
		return error;
	}

	/**
	 * Handle and log errors with context
	 */
	private handleError(error: unknown, context: string): void {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		const logMessage = `Joplin Portal: ${context} - ${errorMessage}`;

		console.error(logMessage, error);

		// Additional logging for debugging
		if (error instanceof Error && 'status' in error) {
			console.error(`Joplin Portal: HTTP Status: ${(error as JoplinApiError).status}`);
		}
	}

	/**
	 * Check if the service is properly configured
	 */
	isConfigured(): boolean {
		return !!(this.baseUrl && this.token);
	}

	/**
	 * Get current configuration status for debugging
	 */
	getConfigStatus(): { hasUrl: boolean; hasToken: boolean; baseUrl?: string } {
		return {
			hasUrl: !!this.baseUrl,
			hasToken: !!this.token,
			baseUrl: this.baseUrl || undefined
		};
	}
}