import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';
import {
	JoplinNote,
	JoplinSearchResponse,
	SearchOptions,
	SearchResult,
	JoplinApiError,
	JoplinPortalSettings,
	RetryConfig,
	RateLimitConfig,
	RequestQueueItem,
	SearchValidationResult,
	TagSearchOptions
} from './types';
import { SearchCache } from './search-cache';
import { ErrorHandler } from './error-handler';
import { RetryUtility } from './retry-utility';

/**
 * Service class for communicating with Joplin API
 * Handles authentication, HTTP requests, error handling, retry logic, and rate limiting
 */
export class JoplinApiService {
	private baseUrl: string;
	private token: string;
	private retryConfig: RetryConfig;
	private rateLimitConfig: RateLimitConfig;
	private requestQueue: RequestQueueItem[] = [];
	private activeRequests = 0;
	private requestTimestamps: number[] = [];
	private isProcessingQueue = false;
	private searchCache: SearchCache;
	private connectionTestWithRetry: (...args: any[]) => Promise<boolean>;
	private searchNotesWithRetry: (...args: any[]) => Promise<SearchResult[]>;
	private getNoteWithRetry: (...args: any[]) => Promise<JoplinNote | null>;

	constructor(settings: JoplinPortalSettings) {
		this.baseUrl = settings.serverUrl.replace(/\/$/, ''); // Remove trailing slash
		this.token = settings.apiToken;

		// Initialize search cache
		this.searchCache = new SearchCache(50, 10); // 50 entries, 10 minutes TTL

		// Configure retry behavior
		this.retryConfig = {
			maxRetries: 3,
			baseDelay: 1000,
			maxDelay: 30000,
			backoffMultiplier: 2
		};

		// Configure rate limiting
		this.rateLimitConfig = {
			maxRequestsPerMinute: 60,
			maxConcurrentRequests: 5
		};

		// Create retry wrappers for key methods
		this.connectionTestWithRetry = RetryUtility.createRetryWrapper(
			this.testConnectionInternal.bind(this),
			this.retryConfig,
			'Connection test'
		);

		this.searchNotesWithRetry = RetryUtility.createRetryWrapper(
			this.searchNotesInternal.bind(this),
			this.retryConfig,
			'Search notes'
		);

		this.getNoteWithRetry = RetryUtility.createRetryWrapper(
			this.getNoteInternal.bind(this),
			this.retryConfig,
			'Get note'
		);

		// Start processing request queue
		this.startQueueProcessor();
	}

	/**
	 * Update service configuration with new settings
	 */
	updateSettings(settings: JoplinPortalSettings): void {
		this.baseUrl = settings.serverUrl.replace(/\/$/, '');
		this.token = settings.apiToken;

		// Clear request history and cache when settings change
		this.requestTimestamps = [];
		this.requestQueue = [];
		this.searchCache.clear();
	}

	/**
	 * Test connection to Joplin server using ping endpoint with retry logic
	 * @returns Promise<boolean> - true if connection successful
	 */
	async testConnection(): Promise<boolean> {
		try {
			// Check if offline first
			if (!ErrorHandler.isOnline()) {
				console.log('Joplin Portal: System is offline, skipping connection test');
				return false;
			}

			return await this.connectionTestWithRetry();
		} catch (error) {
			const userError = ErrorHandler.handleApiError(error, 'Connection test');
			ErrorHandler.logDetailedError(error, 'Connection test failed', {
				baseUrl: this.baseUrl,
				hasToken: !!this.token
			});
			return false;
		}
	}

	/**
	 * Internal connection test method (without retry wrapper)
	 */
	private async testConnectionInternal(): Promise<boolean> {
		const response = await this.makeRequestQueued('/ping');
		return response.status === 200;
	}

	/**
	 * Validate search query and options
	 * @param query - Search query string
	 * @param options - Search options
	 * @returns SearchValidationResult - Validation result with errors and warnings
	 */
	validateSearchQuery(query: string, options?: SearchOptions): SearchValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];
		let normalizedQuery = query.trim();

		// Check if query is empty
		if (!normalizedQuery) {
			errors.push('Search query cannot be empty');
			return { isValid: false, errors, warnings };
		}

		// Check query length limits
		if (normalizedQuery.length > 1000) {
			errors.push('Search query is too long (maximum 1000 characters)');
		}

		// Check for potentially problematic characters
		const problematicChars = /[<>{}[\]\\]/g;
		if (problematicChars.test(normalizedQuery)) {
			warnings.push('Query contains special characters that might affect search results');
		}

		// Validate search options
		if (options) {
			if (options.limit && (options.limit < 1 || options.limit > 100)) {
				warnings.push('Search limit should be between 1 and 100 for optimal performance');
			}

			if (options.page && options.page < 1) {
				errors.push('Page number must be greater than 0');
			}

			if (options.tags && options.tags.length > 10) {
				warnings.push('Searching with many tags may slow down results');
			}
		}

		// Normalize query for better search results
		normalizedQuery = normalizedQuery
			.replace(/\s+/g, ' ') // Replace multiple spaces with single space
			.toLowerCase(); // Convert to lowercase for consistent caching

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
			normalizedQuery
		};
	}

	/**
	 * Search notes using Joplin API with retry logic, caching, and error handling
	 * @param query - Search query string
	 * @param options - Search options (fields, limit, etc.)
	 * @returns Promise<SearchResult[]> - Array of search results with snippets and relevance
	 */
	async searchNotes(query: string, options?: SearchOptions): Promise<SearchResult[]> {
		// Validate query first
		const validation = this.validateSearchQuery(query, options);
		if (!validation.isValid) {
			console.warn('Joplin Portal: Invalid search query:', validation.errors);
			return [];
		}

		// Show warnings if any
		if (validation.warnings.length > 0) {
			console.warn('Joplin Portal: Search warnings:', validation.warnings);
		}

		const normalizedQuery = validation.normalizedQuery || query.trim();

		// Check cache first
		const cachedResults = this.searchCache.get(normalizedQuery, options);
		if (cachedResults) {
			console.log('Joplin Portal: Using cached search results');
			return cachedResults;
		}

		try {
			// Check if offline first
			if (!ErrorHandler.isOnline()) {
				const offlineError = ErrorHandler.createOfflineError();
				ErrorHandler.showErrorNotice(offlineError);
				return [];
			}

			const results = await this.searchNotesWithRetry(normalizedQuery, options);

			// Cache the results
			this.searchCache.set(normalizedQuery, results, options);

			return results;
		} catch (error) {
			const userError = ErrorHandler.handleApiError(error, 'Search notes');
			ErrorHandler.showErrorNotice(userError);
			ErrorHandler.logDetailedError(error, 'Search notes failed', {
				query: normalizedQuery,
				options
			});
			return [];
		}
	}

	/**
	 * Search notes by tags using Joplin API
	 * @param tagOptions - Tag search options
	 * @returns Promise<SearchResult[]> - Array of search results
	 */
	async searchNotesByTags(tagOptions: TagSearchOptions): Promise<SearchResult[]> {
		if (!tagOptions.tags || tagOptions.tags.length === 0) {
			return [];
		}

		try {
			// Check if offline first
			if (!ErrorHandler.isOnline()) {
				const offlineError = ErrorHandler.createOfflineError();
				ErrorHandler.showErrorNotice(offlineError);
				return [];
			}

			// Build tag query - Joplin supports tag: prefix for tag searches
			const tagQueries = tagOptions.tags.map(tag => `tag:${tag.replace(/\s+/g, '_')}`);
			let searchQuery: string;

			if (tagOptions.operator === 'AND') {
				// For AND operation, combine all tag queries
				searchQuery = tagQueries.join(' ');
			} else {
				// For OR operation, use parentheses and OR
				searchQuery = `(${tagQueries.join(' OR ')})`;
			}

			// Add text query if provided
			if (tagOptions.includeText && tagOptions.textQuery) {
				const textQuery = tagOptions.textQuery.trim();
				if (textQuery) {
					searchQuery = `${searchQuery} ${textQuery}`;
				}
			}

			// Check cache first
			const cacheKey = `tags:${JSON.stringify(tagOptions)}`;
			const cachedResults = this.searchCache.get(cacheKey);
			if (cachedResults) {
				console.log('Joplin Portal: Using cached tag search results');
				return cachedResults;
			}

			const results = await this.searchNotesWithRetry(searchQuery, {
				searchType: 'tag',
				tags: tagOptions.tags
			});

			// Cache the results
			this.searchCache.set(cacheKey, results);

			return results;
		} catch (error) {
			const userError = ErrorHandler.handleApiError(error, 'Search notes by tags');
			ErrorHandler.showErrorNotice(userError);
			ErrorHandler.logDetailedError(error, 'Tag search failed', { tagOptions });
			return [];
		}
	}

	/**
	 * Internal search notes method (without retry wrapper)
	 */
	private async searchNotesInternal(query: string, options?: SearchOptions): Promise<SearchResult[]> {
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

		const response = await this.makeRequestQueued(`/search?${params.toString()}`);
		const data: JoplinSearchResponse = await response.json;

		// Transform JoplinNote[] to SearchResult[]
		return this.transformToSearchResults(data.items || [], query);
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
			selected: false,
			markedForImport: false
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
	 * Search notes with pagination support and retry logic
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
			// Check if offline first
			if (!ErrorHandler.isOnline()) {
				const offlineError = ErrorHandler.createOfflineError();
				ErrorHandler.showErrorNotice(offlineError);
				return { results: [], hasMore: false };
			}

			const results = await RetryUtility.executeWithRetry(
				async () => {
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

					const response = await this.makeRequestQueued(`/search?${params.toString()}`);
					const data: JoplinSearchResponse = await response.json;

					return {
						results: this.transformToSearchResults(data.items || [], query),
						hasMore: data.has_more || false
					};
				},
				this.retryConfig,
				'Search notes with pagination'
			);

			return results;
		} catch (error) {
			const userError = ErrorHandler.handleApiError(error, 'Search notes with pagination');
			ErrorHandler.showErrorNotice(userError);
			ErrorHandler.logDetailedError(error, 'Search notes with pagination failed', {
				query,
				options
			});
			return { results: [], hasMore: false };
		}
	}

	/**
	 * Get a specific note by ID with retry logic
	 * @param id - Note ID
	 * @returns Promise<JoplinNote | null> - Note data or null if not found
	 */
	async getNote(id: string): Promise<JoplinNote | null> {
		try {
			// Check if offline first
			if (!ErrorHandler.isOnline()) {
				const offlineError = ErrorHandler.createOfflineError();
				ErrorHandler.showErrorNotice(offlineError);
				return null;
			}

			return await this.getNoteWithRetry(id);
		} catch (error) {
			// Handle 404 errors gracefully (note not found)
			if (error instanceof Error && 'status' in error && (error as JoplinApiError).status === 404) {
				console.log(`Joplin Portal: Note not found: ${id}`);
				return null;
			}

			const userError = ErrorHandler.handleApiError(error, `Get note ${id}`);
			ErrorHandler.showErrorNotice(userError);
			ErrorHandler.logDetailedError(error, 'Get note failed', { noteId: id });
			return null;
		}
	}

	/**
	 * Get the full URL for a Joplin resource.
	 * @param resourceId The ID of the resource.
	 * @returns The full URL to the resource file.
	 */
	public getResourceUrl(resourceId: string): string {
		if (!this.baseUrl || !this.token) {
			return '';
		}
		return `${this.baseUrl}/resources/${resourceId}/file?token=${this.token}`;
	}

	/**
	 * Process note body to convert Joplin resource links to proper API URLs for preview
	 * This is a simple replacement that works for the preview panel
	 * @param noteBody - The original note body with Joplin resource links
	 * @returns string - Processed note body with API URLs
	 */
	processNoteBodyForPreview(noteBody: string): string {
		if (!noteBody || !this.baseUrl || !this.token) {
			return noteBody;
		}

		let processedBody = noteBody;

		// Replace markdown format: ![alt](:/resource_id) -> ![alt](API_URL)
		processedBody = processedBody.replace(
			/!\[(.*?)\]\(:\/([a-f0-9]{32})\)/g,
			(match, altText, resourceId) => {
				const apiUrl = this.getResourceUrl(resourceId);
				return `![${altText}](${apiUrl})`;
			}
		);

		// Replace HTML format: <img src="joplin-id:resource_id" ... /> -> <img src="API_URL" ... />
		processedBody = processedBody.replace(
			/(<img[^>]*src=["'])joplin-id:([a-f0-9]{32})(["'][^>]*>)/g,
			(match, prefix, resourceId, suffix) => {
				const apiUrl = this.getResourceUrl(resourceId);
				return `${prefix}${apiUrl}${suffix}`;
			}
		);

		return processedBody;
	}

	/**
	 * Internal get note method (without retry wrapper)
	 */
	private async getNoteInternal(id: string): Promise<JoplinNote | null> {
		const params = new URLSearchParams({
			fields: 'id,title,body,created_time,updated_time,parent_id,source_url'
		});

		const response = await this.makeRequestQueued(`/notes/${id}?${params.toString()}`);

		if (response.status === 404) {
			return null;
		}

		return await response.json as JoplinNote;
	}

	/**
	 * Make HTTP request to Joplin API with authentication and rate limiting
	 * @param endpoint - API endpoint (without base URL)
	 * @param options - Additional request options
	 * @returns Promise<RequestUrlResponse> - HTTP response
	 */
	private async makeRequestQueued(
		endpoint: string,
		options: Partial<RequestUrlParam> = {}
	): Promise<RequestUrlResponse> {
		return new Promise((resolve, reject) => {
			const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

			const queueItem: RequestQueueItem = {
				id: requestId,
				request: () => this.makeRequestDirect(endpoint, options),
				resolve,
				reject,
				timestamp: Date.now(),
				retryCount: 0
			};

			this.requestQueue.push(queueItem);
			this.processQueue();
		});
	}

	/**
	 * Make direct HTTP request to Joplin API (bypassing queue)
	 */
	private async makeRequestDirect(
		endpoint: string,
		options: Partial<RequestUrlParam> = {}
	): Promise<RequestUrlResponse> {
		if (!this.token) {
			throw ErrorHandler.createApiError('API token is required', 401, 'MISSING_TOKEN');
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

			// Check for API errors and determine if retryable
			if (response.status >= 400) {
				const isRetryable = response.status === 429 || response.status >= 500;
				const retryAfter = response.status === 429 ? this.parseRetryAfter(response.headers) : undefined;

				throw ErrorHandler.createApiError(
					`HTTP ${response.status}: ${response.text || 'Unknown error'}`,
					response.status,
					'HTTP_ERROR',
					isRetryable,
					retryAfter
				);
			}

			return response;
		} catch (error) {
			if (error instanceof Error && 'status' in error) {
				// Re-throw API errors as-is
				throw error;
			}

			// Handle network/connection errors (these are retryable)
			throw ErrorHandler.createApiError(
				`Network error: ${error instanceof Error ? error.message : 'Connection failed'}`,
				0,
				'NETWORK_ERROR',
				true // Network errors are retryable
			);
		}
	}

	/**
	 * Process the request queue with rate limiting
	 */
	private async processQueue(): Promise<void> {
		if (this.isProcessingQueue || this.requestQueue.length === 0) {
			return;
		}

		this.isProcessingQueue = true;

		while (this.requestQueue.length > 0) {
			// Check rate limits
			if (!this.canMakeRequest()) {
				// Wait before checking again
				await this.sleep(1000);
				continue;
			}

			const queueItem = this.requestQueue.shift();
			if (!queueItem) {
				continue;
			}

			// Check if request has expired (older than 5 minutes)
			if (Date.now() - queueItem.timestamp > 300000) {
				queueItem.reject(ErrorHandler.createApiError(
					'Request expired in queue',
					408,
					'REQUEST_EXPIRED'
				));
				continue;
			}

			this.activeRequests++;
			this.recordRequest();

			try {
				const result = await queueItem.request();
				queueItem.resolve(result);
			} catch (error) {
				queueItem.reject(error);
			} finally {
				this.activeRequests--;
			}

			// Small delay between requests to be respectful
			await this.sleep(100);
		}

		this.isProcessingQueue = false;
	}

	/**
	 * Start the queue processor
	 */
	private startQueueProcessor(): void {
		// Process queue every second
		setInterval(() => {
			if (!this.isProcessingQueue && this.requestQueue.length > 0) {
				this.processQueue();
			}
		}, 1000);
	}

	/**
	 * Check if we can make a request based on rate limits
	 */
	private canMakeRequest(): boolean {
		const now = Date.now();
		const oneMinuteAgo = now - 60000;

		// Clean old timestamps
		this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp > oneMinuteAgo);

		// Check concurrent request limit
		if (this.activeRequests >= this.rateLimitConfig.maxConcurrentRequests) {
			return false;
		}

		// Check requests per minute limit
		if (this.requestTimestamps.length >= this.rateLimitConfig.maxRequestsPerMinute) {
			return false;
		}

		return true;
	}

	/**
	 * Record a request timestamp for rate limiting
	 */
	private recordRequest(): void {
		this.requestTimestamps.push(Date.now());
	}

	/**
	 * Parse Retry-After header from rate limit responses
	 */
	private parseRetryAfter(headers: Record<string, string>): number | undefined {
		const retryAfter = headers['retry-after'] || headers['Retry-After'];
		if (retryAfter) {
			const seconds = parseInt(retryAfter, 10);
			return isNaN(seconds) ? undefined : seconds;
		}
		return undefined;
	}

	/**
	 * Sleep for specified milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Get current queue status for debugging
	 */
	getQueueStatus(): {
		queueLength: number;
		activeRequests: number;
		requestsInLastMinute: number;
		isProcessing: boolean;
	} {
		const now = Date.now();
		const oneMinuteAgo = now - 60000;
		const recentRequests = this.requestTimestamps.filter(timestamp => timestamp > oneMinuteAgo);

		return {
			queueLength: this.requestQueue.length,
			activeRequests: this.activeRequests,
			requestsInLastMinute: recentRequests.length,
			isProcessing: this.isProcessingQueue
		};
	}

	/**
	 * Clear the request queue (useful for cleanup or reset)
	 */
	clearQueue(): void {
		// Reject all pending requests
		this.requestQueue.forEach(item => {
			item.reject(ErrorHandler.createApiError(
				'Request cancelled due to queue clear',
				499,
				'REQUEST_CANCELLED'
			));
		});

		this.requestQueue = [];
		this.requestTimestamps = [];
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

	/**
	 * Get search cache statistics for debugging
	 */
	getCacheStats(): any {
		return this.searchCache.getStats();
	}

	/**
	 * Clear search cache
	 */
	clearSearchCache(): void {
		this.searchCache.clear();
	}

	/**
	 * Clear all caches
	 */
	clearAllCaches(): void {
		this.searchCache.clear();
	}

	/**
	 * Invalidate cache entries related to specific keywords
	 * Useful when notes are imported or modified
	 */
	invalidateSearchCache(keywords: string[]): void {
		this.searchCache.invalidateRelated(keywords);
	}

	/**
	 * Get available tags from recent search results (if supported by API)
	 * This is a helper method to suggest tags for tag-based searches
	 */
	getAvailableTags(): string[] {
		// This would ideally call a Joplin API endpoint to get all tags
		// For now, we'll return an empty array as this depends on Joplin API support
		// In a real implementation, you might cache tags from search results
		return [];
	}
}