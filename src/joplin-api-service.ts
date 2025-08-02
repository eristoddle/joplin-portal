import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';
import {
	JoplinNote,
	JoplinSearchResponse,
	SearchOptions,
	SearchResult,
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
	 * @returns Promise<SearchResult[]> - Array of search results with snippets and relevance
	 */
	async searchNotes(query: string, options?: SearchOptions): Promise<SearchResult[]> {
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

			// Transform JoplinNote[] to SearchResult[]
			return this.transformToSearchResults(data.items || [], query);
		} catch (error) {
			this.handleError(error, 'Failed to search notes');
			return [];
		}
	}

	/**
	 * Transform JoplinNote array to SearchResult array
	 * @param notes - Array of JoplinNote objects from API
	 * @param query - Original search query for snippet generation
	 * @returns SearchResult[] - Transformed search results
	 */
	private transformToSearchResults(notes: JoplinNote[], query: string): SearchResult[] {
		return notes.map((note, index) => ({
			note,
			snippet: this.generateSnippet(note.body, query),
			relevance: this.calculateRelevance(note, query, index),
			selected: false
		}));
	}

	/**
	 * Generate a snippet from note body highlighting search terms
	 * @param body - Full note body text
	 * @param query - Search query to highlight
	 * @returns string - Generated snippet with context around search terms
	 */
	private generateSnippet(body: string, query: string): string {
		if (!body || !query) {
			return body ? body.substring(0, 150) + (body.length > 150 ? '...' : '') : '';
		}

		// Clean the body text (remove markdown formatting for snippet)
		const cleanBody = body.replace(/[#*_`~]/g, '').replace(/\n+/g, ' ').trim();

		if (cleanBody.length <= 150) {
			return cleanBody;
		}

		// Find the first occurrence of any search term
		const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
		const lowerBody = cleanBody.toLowerCase();

		let bestMatch = -1;
		let bestTerm = '';

		for (const term of searchTerms) {
			const index = lowerBody.indexOf(term);
			if (index !== -1 && (bestMatch === -1 || index < bestMatch)) {
				bestMatch = index;
				bestTerm = term;
			}
		}

		if (bestMatch === -1) {
			// No search terms found, return beginning of text
			return cleanBody.substring(0, 150) + '...';
		}

		// Create snippet centered around the match
		const snippetLength = 150;
		const termLength = bestTerm.length;
		const contextBefore = Math.floor((snippetLength - termLength) / 2);

		let start = Math.max(0, bestMatch - contextBefore);
		let end = Math.min(cleanBody.length, start + snippetLength);

		// Adjust start if we're near the end
		if (end - start < snippetLength && start > 0) {
			start = Math.max(0, end - snippetLength);
		}

		let snippet = cleanBody.substring(start, end);

		// Add ellipsis if we're not at the beginning/end
		if (start > 0) snippet = '...' + snippet;
		if (end < cleanBody.length) snippet = snippet + '...';

		return snippet;
	}

	/**
	 * Calculate relevance score for search result
	 * @param note - The note to score
	 * @param query - Search query
	 * @param index - Position in search results (for tie-breaking)
	 * @returns number - Relevance score (higher is more relevant)
	 */
	private calculateRelevance(note: JoplinNote, query: string, index: number): number {
		const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
		let score = 0;

		const title = note.title.toLowerCase();
		const body = note.body.toLowerCase();

		// Title matches are worth more
		for (const term of searchTerms) {
			if (title.includes(term)) {
				score += 10;
				// Exact title match gets bonus
				if (title === term) {
					score += 20;
				}
			}
			if (body.includes(term)) {
				score += 1;
			}
		}

		// Newer notes get slight boost (within last 30 days)
		const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
		if (note.updated_time > thirtyDaysAgo) {
			score += 2;
		}

		// Use negative index for tie-breaking (earlier results preferred)
		return score - (index * 0.01);
	}

	/**
	 * Search notes with pagination support
	 * @param query - Search query string
	 * @param options - Search options including pagination
	 * @returns Promise<{results: SearchResult[], hasMore: boolean}> - Paginated search results
	 */
	async searchNotesWithPagination(
		query: string,
		options?: SearchOptions
	): Promise<{results: SearchResult[], hasMore: boolean}> {
		if (!query.trim()) {
			return { results: [], hasMore: false };
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

			return {
				results: this.transformToSearchResults(data.items || [], query),
				hasMore: data.has_more || false
			};
		} catch (error) {
			this.handleError(error, 'Failed to search notes with pagination');
			return { results: [], hasMore: false };
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