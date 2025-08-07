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
	TagSearchOptions,
	JoplinResource,
	ImageProcessingResult,
	ImageProcessingOptions,
	ImageProcessingProgress
} from './types';
import { SearchCache } from './search-cache';
import { ImageCache } from './image-cache';
import { ImageCompression, CompressionOptions } from './image-compression';
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
	private imageCache: ImageCache;
	private connectionTestWithRetry: (...args: any[]) => Promise<boolean>;
	private searchNotesWithRetry: (...args: any[]) => Promise<SearchResult[]>;
	private getNoteWithRetry: (...args: any[]) => Promise<JoplinNote | null>;

	constructor(settings: JoplinPortalSettings) {
		this.baseUrl = settings.serverUrl.replace(/\/$/, ''); // Remove trailing slash
		this.token = settings.apiToken;

		// Initialize search cache
		this.searchCache = new SearchCache(50, 10); // 50 entries, 10 minutes TTL

		// Initialize image cache
		this.imageCache = new ImageCache(100, 50, 30); // 100 images, 50MB, 30 minutes TTL

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
		this.imageCache.clear();
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
	 * Get image cache statistics for debugging
	 */
	getImageCacheStats(): any {
		return this.imageCache.getStats();
	}

	/**
	 * Clear search cache
	 */
	clearSearchCache(): void {
		this.searchCache.clear();
	}

	/**
	 * Clear image cache
	 */
	clearImageCache(): void {
		this.imageCache.clear();
	}

	/**
	 * Clear all caches
	 */
	clearAllCaches(): void {
		this.searchCache.clear();
		this.imageCache.clear();
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

	/**
	 * Get resource metadata including MIME type and other information
	 * @param resourceId - The ID of the resource
	 * @returns Promise<JoplinResource | null> - Resource metadata or null if not found
	 */
	async getResourceMetadata(resourceId: string): Promise<JoplinResource | null> {
		try {
			// Check if offline first
			if (!ErrorHandler.isOnline()) {
				console.log(`Joplin Portal: System is offline, cannot fetch resource metadata: ${resourceId}`);
				throw new Error('System is offline - cannot fetch resource metadata');
			}

			// Validate resource ID format
			if (!resourceId || !/^[a-f0-9]{32}$/.test(resourceId)) {
				throw new Error(`Invalid resource ID format: ${resourceId}`);
			}

			const response = await RetryUtility.executeWithRetry(
				async () => {
					const response = await this.makeRequestQueued(`/resources/${resourceId}`);

					if (response.status === 404) {
						throw new Error('Resource not found - may have been deleted');
					}

					const metadata = await response.json as JoplinResource;

					// Validate metadata structure
					if (!metadata.id || !metadata.mime) {
						throw new Error('Invalid resource metadata received from server');
					}

					return metadata;
				},
				{
					maxRetries: 2,
					baseDelay: 500,
					maxDelay: 3000,
					backoffMultiplier: 2
				},
				`Get resource metadata ${resourceId}`
			);

			console.log(`Joplin Portal: Successfully retrieved metadata for resource ${resourceId} (${response.mime})`);
			return response;
		} catch (error) {
			// Log detailed error for debugging
			ErrorHandler.logDetailedError(error, 'Get resource metadata failed', {
				resourceId,
				isOnline: ErrorHandler.isOnline(),
				timestamp: new Date().toISOString()
			});

			// Re-throw the error to be handled by the calling method
			throw error;
		}
	}

	/**
	 * Get resource file data as ArrayBuffer
	 * @param resourceId - The ID of the resource
	 * @returns Promise<ArrayBuffer | null> - Raw binary data or null if not found/failed
	 */
	async getResourceFile(resourceId: string): Promise<ArrayBuffer | null> {
		try {
			// Check if offline first
			if (!ErrorHandler.isOnline()) {
				console.log(`Joplin Portal: System is offline, cannot fetch resource file: ${resourceId}`);
				throw new Error('System is offline - cannot fetch resource file');
			}

			// Validate resource ID format
			if (!resourceId || !/^[a-f0-9]{32}$/.test(resourceId)) {
				throw new Error(`Invalid resource ID format: ${resourceId}`);
			}

			const response = await RetryUtility.executeWithRetry(
				async () => {
					const response = await this.makeRequestDirect(`/resources/${resourceId}/file`);

					if (response.status === 404) {
						throw new Error('Resource file not found - may have been deleted');
					}

					const arrayBuffer = response.arrayBuffer;

					// Validate that we received data
					if (!arrayBuffer || arrayBuffer.byteLength === 0) {
						throw new Error('Received empty or invalid file data from server');
					}

					return arrayBuffer;
				},
				{
					maxRetries: 3, // More retries for file downloads as they're more likely to have network issues
					baseDelay: 1000,
					maxDelay: 10000,
					backoffMultiplier: 2
				},
				`Get resource file ${resourceId}`
			);

			console.log(`Joplin Portal: Successfully downloaded resource file ${resourceId} (${response.byteLength} bytes)`);
			return response;
		} catch (error) {
			// Log detailed error for debugging
			ErrorHandler.logDetailedError(error, 'Get resource file failed', {
				resourceId,
				isOnline: ErrorHandler.isOnline(),
				timestamp: new Date().toISOString()
			});

			// Re-throw the error to be handled by the calling method
			throw error;
		}
	}

	/**
	 * Process note body to convert Joplin resource links to base64 data URIs with optimizations
	 * Handles both markdown format ![alt](:/resource_id) and HTML format <img src="joplin-id:resource_id"/>
	 * @param noteBody - The original note body with Joplin resource links
	 * @param options - Processing options including progress callback and concurrency settings
	 * @returns Promise<string> - Processed note body with base64 data URIs
	 */
	async processNoteBodyForImages(
		noteBody: string,
		options: ImageProcessingOptions = {}
	): Promise<string> {
		if (!noteBody) {
			return noteBody;
		}

		const {
			maxConcurrency = 3,
			maxImageSize = 10 * 1024 * 1024, // 10MB
			enableCompression = true,
			compressionQuality = 0.8,
			onProgress
		} = options;

		// Regex to find Joplin image resource links: ![alt](:/resource_id)
		const resourceLinkRegex = /!\[(.*?)\]\(:\/([a-f0-9]{32})\)/g;
		const markdownMatches = Array.from(noteBody.matchAll(resourceLinkRegex));

		// Regex to find HTML img tags with joplin-id: URLs: <img src="joplin-id:resource_id" ... />
		const htmlImageRegex = /<img[^>]*src=["']joplin-id:([a-f0-9]{32})["'][^>]*>/g;
		const htmlMatches = Array.from(noteBody.matchAll(htmlImageRegex));

		const totalMatches = markdownMatches.length + htmlMatches.length;

		if (totalMatches === 0) {
			return noteBody;
		}

		console.log(`Joplin Portal: Processing ${totalMatches} image resources in note (${markdownMatches.length} markdown, ${htmlMatches.length} HTML) with concurrency ${maxConcurrency}`);

		// Initialize progress tracking
		const progress: ImageProcessingProgress = {
			total: totalMatches,
			processed: 0,
			failed: 0
		};

		// Process markdown images
		const markdownResults = await this.processImagesWithConcurrency(
			markdownMatches,
			maxConcurrency,
			maxImageSize,
			enableCompression,
			compressionQuality,
			progress,
			onProgress
		);

		// Process HTML images
		const htmlResults = await this.processHtmlImagesWithConcurrency(
			htmlMatches,
			maxConcurrency,
			maxImageSize,
			enableCompression,
			compressionQuality,
			progress,
			onProgress
		);

		// Replace the original links with processed ones
		let processedBody = noteBody;
		let successCount = 0;
		let failureCount = 0;
		let placeholderCount = 0;
		let cacheHits = 0;

		// Process markdown results
		for (const result of markdownResults) {
			if (result.success) {
				processedBody = processedBody.replace(result.originalLink, result.processedLink);
				if (result.isPlaceholder) {
					placeholderCount++;
				} else {
					successCount++;
					if (result.fromCache) {
						cacheHits++;
					}
				}
			} else {
				failureCount++;
				// For failed images, replace with placeholder
				const placeholderLink = this.createImagePlaceholder(result.originalLink, result.error || 'Unknown error');
				processedBody = processedBody.replace(result.originalLink, placeholderLink);

				// Log detailed error information for debugging
				ErrorHandler.logDetailedError(
					new Error(result.error || 'Image processing failed'),
					'Image processing failure',
					{
						resourceId: result.resourceId,
						originalLink: result.originalLink,
						mimeType: result.mimeType,
						retryCount: result.retryCount
					}
				);
			}
		}

		// Process HTML results
		for (const result of htmlResults) {
			if (result.success) {
				processedBody = processedBody.replace(result.originalLink, result.processedLink);
				if (result.isPlaceholder) {
					placeholderCount++;
				} else {
					successCount++;
					if (result.fromCache) {
						cacheHits++;
					}
				}
			} else {
				failureCount++;
				// For failed images, replace with placeholder
				const placeholderLink = this.createHtmlImagePlaceholder(result.originalLink, result.error || 'Unknown error');
				processedBody = processedBody.replace(result.originalLink, placeholderLink);

				// Log detailed error information for debugging
				ErrorHandler.logDetailedError(
					new Error(result.error || 'Image processing failed'),
					'HTML image processing failure',
					{
						resourceId: result.resourceId,
						originalLink: result.originalLink,
						mimeType: result.mimeType,
						retryCount: result.retryCount
					}
				);
			}
		}

		console.log(`Joplin Portal: Image processing complete. Success: ${successCount} (${cacheHits} from cache), Placeholders: ${placeholderCount}, Failed: ${failureCount}`);

		// Perform cache maintenance periodically
		if (Math.random() < 0.1) { // 10% chance
			this.imageCache.performMaintenance();
		}

		return processedBody;
	}

	/**
	 * Process multiple images with controlled concurrency
	 * @param matches - Array of regex matches for image links
	 * @param maxConcurrency - Maximum number of concurrent image processing operations
	 * @param maxImageSize - Maximum image size in bytes
	 * @param enableCompression - Whether to enable image compression
	 * @param compressionQuality - Compression quality (0.1 to 1.0)
	 * @param progress - Progress tracking object
	 * @param onProgress - Progress callback function
	 * @returns Promise<ImageProcessingResult[]> - Array of processing results
	 */
	private async processImagesWithConcurrency(
		matches: RegExpMatchArray[],
		maxConcurrency: number,
		maxImageSize: number,
		enableCompression: boolean,
		compressionQuality: number,
		progress: ImageProcessingProgress,
		onProgress?: (progress: ImageProcessingProgress) => void
	): Promise<ImageProcessingResult[]> {
		const results: ImageProcessingResult[] = [];
		const semaphore = new Array(maxConcurrency).fill(null);
		let currentIndex = 0;

		// Process images in batches with controlled concurrency
		const processNextBatch = async (): Promise<void> => {
			const batch: Promise<void>[] = [];

			for (let i = 0; i < maxConcurrency && currentIndex < matches.length; i++) {
				const matchIndex = currentIndex++;
				const match = matches[matchIndex];
				const [originalLink, altText, resourceId] = match;

				progress.current = `Processing image ${matchIndex + 1}/${matches.length}`;
				onProgress?.(progress);

				const processPromise = this.processImageResourceOptimized(
					originalLink,
					altText,
					resourceId,
					maxImageSize,
					enableCompression,
					compressionQuality
				).then(result => {
					results[matchIndex] = result;
					progress.processed++;
					if (!result.success) {
						progress.failed++;
					}
					onProgress?.(progress);
				}).catch(error => {
					// Handle unexpected errors
					const errorResult: ImageProcessingResult = {
						originalLink,
						processedLink: this.createImagePlaceholder(originalLink, error.message),
						success: true, // Mark as success since we have a placeholder
						error: error.message,
						resourceId,
						isPlaceholder: true
					};
					results[matchIndex] = errorResult;
					progress.processed++;
					progress.failed++;
					onProgress?.(progress);
				});

				batch.push(processPromise);
			}

			if (batch.length > 0) {
				await Promise.all(batch);
			}
		};

		// Process all images in batches
		while (currentIndex < matches.length) {
			await processNextBatch();
		}

		// Ensure results array is complete (fill any gaps with placeholders)
		for (let i = 0; i < matches.length; i++) {
			if (!results[i]) {
				const [originalLink] = matches[i];
				results[i] = {
					originalLink,
					processedLink: this.createImagePlaceholder(originalLink, 'Processing failed'),
					success: true,
					error: 'Processing failed',
					isPlaceholder: true
				};
			}
		}

		return results;
	}

	/**
	 * Process a single image resource with caching, compression, and optimization
	 * @param originalLink - The original markdown link
	 * @param altText - Alt text for the image
	 * @param resourceId - Joplin resource ID
	 * @param maxImageSize - Maximum image size in bytes
	 * @param enableCompression - Whether to enable compression
	 * @param compressionQuality - Compression quality
	 * @returns Promise<ImageProcessingResult> - Processing result
	 */
	private async processImageResourceOptimized(
		originalLink: string,
		altText: string,
		resourceId: string,
		maxImageSize: number,
		enableCompression: boolean,
		compressionQuality: number
	): Promise<ImageProcessingResult> {
		// Check cache first
		const cachedDataUri = this.imageCache.get(resourceId);
		if (cachedDataUri) {
			console.log(`Joplin Portal: Using cached image for resource ${resourceId}`);
			return {
				originalLink,
				processedLink: `![${altText}](${cachedDataUri})`,
				success: true,
				resourceId,
				fromCache: true
			};
		}

		// Process with retry logic
		const retryConfig = {
			maxRetries: 2,
			baseDelay: 500,
			maxDelay: 5000,
			backoffMultiplier: 2
		};

		try {
			return await RetryUtility.executeWithRetry(
				async () => {
					return await this.processImageResourceInternalOptimized(
						originalLink,
						altText,
						resourceId,
						maxImageSize,
						enableCompression,
						compressionQuality
					);
				},
				retryConfig,
				`Process optimized image resource ${resourceId}`
			);
		} catch (error) {
			// If all retries failed, create a placeholder result
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			console.warn(`Joplin Portal: Failed to process image resource ${resourceId} after retries: ${errorMessage}`);

			return {
				originalLink,
				processedLink: this.createImagePlaceholder(originalLink, errorMessage),
				success: true, // Mark as success since we have a placeholder
				error: errorMessage,
				resourceId,
				retryCount: retryConfig.maxRetries,
				isPlaceholder: true
			};
		}
	}

	/**
	 * Internal optimized image processing method
	 * @param originalLink - The original markdown link
	 * @param altText - Alt text for the image
	 * @param resourceId - Joplin resource ID
	 * @param maxImageSize - Maximum image size in bytes
	 * @param enableCompression - Whether to enable compression
	 * @param compressionQuality - Compression quality
	 * @returns Promise<ImageProcessingResult> - Processing result
	 */
	private async processImageResourceInternalOptimized(
		originalLink: string,
		altText: string,
		resourceId: string,
		maxImageSize: number,
		enableCompression: boolean,
		compressionQuality: number
	): Promise<ImageProcessingResult> {
		// Get resource metadata to check if it's an image and get MIME type
		const metadata = await this.getResourceMetadata(resourceId);

		if (!metadata) {
			throw new Error('Resource metadata not found - resource may have been deleted');
		}

		// Check if the resource is an image
		if (!metadata.mime.startsWith('image/')) {
			console.log(`Joplin Portal: Resource ${resourceId} is not an image (${metadata.mime}), preserving original link`);
			return {
				originalLink,
				processedLink: originalLink,
				success: true,
				resourceId,
				mimeType: metadata.mime,
				retryCount: 0
			};
		}

		// Check image size before downloading
		if (metadata.size > maxImageSize) {
			console.warn(`Joplin Portal: Image ${resourceId} is too large (${Math.round(metadata.size / 1024 / 1024)}MB), creating placeholder`);
			return {
				originalLink,
				processedLink: this.createImagePlaceholder(originalLink, `Image too large (${Math.round(metadata.size / 1024 / 1024)}MB)`),
				success: true,
				resourceId,
				mimeType: metadata.mime,
				retryCount: 0,
				isPlaceholder: true
			};
		}

		// Get the raw image data
		const imageData = await this.getResourceFile(resourceId);

		if (!imageData) {
			throw new Error('Resource file data not found - file may be corrupted or inaccessible');
		}

		try {
			// Convert ArrayBuffer to base64
			const base64String = this.arrayBufferToBase64(imageData);
			let dataUri = `data:${metadata.mime};base64,${base64String}`;

			// Apply compression if enabled and image is large
			if (enableCompression && ImageCompression.shouldCompress(dataUri)) {
				console.log(`Joplin Portal: Compressing large image ${resourceId}`);

				const compressionOptions: CompressionOptions = {
					quality: compressionQuality,
					maxWidth: 1920,
					maxHeight: 1080,
					format: metadata.mime.includes('png') ? 'png' : 'jpeg'
				};

				const compressionResult = await ImageCompression.compressImage(dataUri, compressionOptions);

				if (compressionResult.wasCompressed) {
					dataUri = compressionResult.compressedDataUri;
					console.log(`Joplin Portal: Compressed image ${resourceId} by ${Math.round((1 - compressionResult.compressionRatio) * 100)}%`);
				}
			}

			// Cache the processed image
			this.imageCache.set(resourceId, dataUri, metadata.mime);

			const processedLink = `![${altText}](${dataUri})`;

			return {
				originalLink,
				processedLink,
				success: true,
				resourceId,
				mimeType: metadata.mime,
				retryCount: 0
			};
		} catch (error) {
			throw new Error(`Failed to convert image to base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Process a single image resource with retry logic and comprehensive error handling
	 * @param originalLink - The original markdown link
	 * @param altText - Alt text for the image
	 * @param resourceId - Joplin resource ID
	 * @returns Promise<ImageProcessingResult> - Processing result with detailed error info
	 */
	private async processImageResourceWithRetry(
		originalLink: string,
		altText: string,
		resourceId: string
	): Promise<ImageProcessingResult> {
		const retryConfig = {
			maxRetries: 2, // Fewer retries for individual images to avoid blocking UI
			baseDelay: 500,
			maxDelay: 5000,
			backoffMultiplier: 2
		};

		try {
			return await RetryUtility.executeWithRetry(
				async () => {
					return await this.processImageResourceInternal(originalLink, altText, resourceId);
				},
				retryConfig,
				`Process image resource ${resourceId}`
			);
		} catch (error) {
			// If all retries failed, create a placeholder result
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			console.warn(`Joplin Portal: Failed to process image resource ${resourceId} after retries: ${errorMessage}`);

			return {
				originalLink,
				processedLink: this.createImagePlaceholder(originalLink, errorMessage),
				success: true, // Mark as success since we have a placeholder
				error: errorMessage,
				resourceId,
				retryCount: retryConfig.maxRetries,
				isPlaceholder: true
			};
		}
	}

	/**
	 * Internal method to process a single image resource (without retry wrapper)
	 * @param originalLink - The original markdown link
	 * @param altText - Alt text for the image
	 * @param resourceId - Joplin resource ID
	 * @returns Promise<ImageProcessingResult> - Processing result
	 */
	private async processImageResourceInternal(
		originalLink: string,
		altText: string,
		resourceId: string
	): Promise<ImageProcessingResult> {
		// Get resource metadata to check if it's an image and get MIME type
		const metadata = await this.getResourceMetadata(resourceId);

		if (!metadata) {
			throw new Error('Resource metadata not found - resource may have been deleted');
		}

		// Check if the resource is an image
		if (!metadata.mime.startsWith('image/')) {
			console.log(`Joplin Portal: Resource ${resourceId} is not an image (${metadata.mime}), preserving original link`);
			return {
				originalLink,
				processedLink: originalLink,
				success: true,
				resourceId,
				mimeType: metadata.mime,
				retryCount: 0
			};
		}

		// Get the raw image data
		const imageData = await this.getResourceFile(resourceId);

		if (!imageData) {
			throw new Error('Resource file data not found - file may be corrupted or inaccessible');
		}

		// Validate image data size (prevent processing extremely large images)
		const maxImageSize = 10 * 1024 * 1024; // 10MB limit
		if (imageData.byteLength > maxImageSize) {
			console.warn(`Joplin Portal: Image ${resourceId} is too large (${imageData.byteLength} bytes), creating placeholder`);
			return {
				originalLink,
				processedLink: this.createImagePlaceholder(originalLink, `Image too large (${Math.round(imageData.byteLength / 1024 / 1024)}MB)`),
				success: true,
				resourceId,
				mimeType: metadata.mime,
				retryCount: 0,
				isPlaceholder: true
			};
		}

		try {
			// Convert ArrayBuffer to base64
			const base64String = this.arrayBufferToBase64(imageData);
			const dataUri = `data:${metadata.mime};base64,${base64String}`;
			const processedLink = `![${altText}](${dataUri})`;

			return {
				originalLink,
				processedLink,
				success: true,
				resourceId,
				mimeType: metadata.mime,
				retryCount: 0
			};
		} catch (error) {
			throw new Error(`Failed to convert image to base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Create a placeholder for failed or missing images
	 * @param originalLink - The original markdown link
	 * @param errorMessage - Error message to include in placeholder
	 * @returns string - Placeholder markdown
	 */
	private createImagePlaceholder(originalLink: string, errorMessage: string): string {
		// Extract alt text from original link
		const altMatch = originalLink.match(/!\[(.*?)\]/);
		const altText = altMatch ? altMatch[1] : 'Image';

		// Extract resource ID for reference
		const resourceMatch = originalLink.match(/:\/([a-f0-9]{32})/);
		const resourceId = resourceMatch ? resourceMatch[1] : 'unknown';

		// Create a descriptive placeholder
		const placeholderText = `[🖼️ Image Unavailable: ${altText || 'Untitled'}]`;
		const errorComment = `<!-- Joplin Portal: Failed to load image resource ${resourceId}. Error: ${errorMessage} -->`;

		return `${placeholderText}\n${errorComment}`;
	}

	/**
	 * Create a placeholder for failed or missing HTML images
	 * @param originalHtmlTag - The original HTML img tag
	 * @param errorMessage - Error message to include in placeholder
	 * @returns string - Placeholder HTML with preserved attributes
	 */
	/**
	 * Create a placeholder for failed or missing HTML images with attribute preservation
	 * @param originalHtmlTag - The original HTML img tag
	 * @param errorMessage - Error message to include in placeholder
	 * @returns string - Placeholder HTML with preserved attributes
	 */
	private createHtmlImagePlaceholder(originalHtmlTag: string, errorMessage: string): string {
		// Extract attributes from the original HTML tag
		const attributes = this.extractHtmlImageAttributes(originalHtmlTag);

		// Extract resource ID for reference with validation
		const resourceMatch = originalHtmlTag.match(/joplin-id:([a-f0-9]{32})/);
		const resourceId = resourceMatch ? resourceMatch[1] : 'unknown';

		// Create placeholder data URI (broken image icon)
		const placeholderDataUri = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBzdHJva2U9IiM5OTk5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';

		// Enhance attributes with placeholder-specific information
		const enhancedAttributes = {
			...attributes,
			alt: attributes.alt || 'Image Unavailable',
			title: `Failed to load image resource ${resourceId}. Error: ${errorMessage}`
		};

		// Use reconstructHtmlImageTag to build the placeholder
		const placeholderTag = this.reconstructHtmlImageTag(placeholderDataUri, enhancedAttributes);
		const errorComment = `<!-- Joplin Portal: Failed to load HTML image resource ${resourceId}. Error: ${errorMessage} -->`;

		return `${placeholderTag}\n${errorComment}`;
	}

	/**
	 * Extract and parse HTML attributes from an img tag with improved parsing
	 * Handles various quote styles, attribute orders, and edge cases
	 * @param htmlTag - The HTML img tag string
	 * @returns Record<string, string> - Object containing all attributes
	 */
	private extractHtmlImageAttributes(htmlTag: string): Record<string, string> {
		const attributes: Record<string, string> = {};

		// Enhanced regex to match HTML attributes with various quote styles and edge cases
		// Matches: attribute="value", attribute='value', attribute=value (no quotes), and boolean attributes
		// Use word boundary and whitespace to avoid matching tag names
		const attributeRegex = /\s+(\w+)(?:=(?:["']([^"']*)["']|([^\s>]+)))?/g;
		let match;

		while ((match = attributeRegex.exec(htmlTag)) !== null) {
			const [, attributeName, quotedValue, unquotedValue] = match;

			// Skip the src attribute as we'll replace it, and skip tag names
			if (attributeName.toLowerCase() === 'src' || attributeName.toLowerCase() === 'img') {
				continue;
			}

			// Handle different attribute value formats
			if (quotedValue !== undefined) {
				// Quoted value (single or double quotes)
				attributes[attributeName] = quotedValue;
			} else if (unquotedValue !== undefined) {
				// Unquoted value
				attributes[attributeName] = unquotedValue;
			} else {
				// Boolean attribute (no value)
				attributes[attributeName] = attributeName;
			}
		}

		return attributes;
	}

	/**
	 * Process HTML img tag to extract resource ID from joplin-id: URL format with validation
	 * @param htmlTag - The complete HTML img tag
	 * @returns object containing resource ID and preserved attributes, or null if invalid
	 */
	private processHtmlImageTag(htmlTag: string): { resourceId: string; attributes: Record<string, string> } | null {
		// Validate resource ID format extracted from joplin-id: URLs
		const resourceMatch = htmlTag.match(/joplin-id:([a-f0-9]{32})/);
		if (!resourceMatch) {
			console.warn('Joplin Portal: Invalid joplin-id format in HTML img tag:', htmlTag);
			return null;
		}

		const resourceId = resourceMatch[1];

		// Additional validation for resource ID format (32-character hex string)
		if (!/^[a-f0-9]{32}$/.test(resourceId)) {
			console.warn('Joplin Portal: Invalid resource ID format extracted from joplin-id URL:', resourceId);
			return null;
		}

		const attributes = this.extractHtmlImageAttributes(htmlTag);

		return { resourceId, attributes };
	}

	/**
	 * Reconstruct HTML img tag with data URI while preserving all attributes
	 * @param dataUri - The data URI to use as the src attribute
	 * @param attributes - Object containing all HTML attributes to preserve
	 * @returns string - Reconstructed HTML img tag
	 */
	private reconstructHtmlImageTag(dataUri: string, attributes: Record<string, string>): string {
		// Create new attributes object with data URI as src
		const reconstructedAttributes = {
			src: dataUri,
			...attributes
		};

		// Build attribute string with proper escaping
		const attributeString = Object.entries(reconstructedAttributes)
			.map(([key, value]) => {
				// Escape quotes in attribute values
				const escapedValue = value.replace(/"/g, '&quot;');
				return `${key}="${escapedValue}"`;
			})
			.join(' ');

		return `<img ${attributeString}/>`;
	}

	/**
	 * Process multiple HTML images with controlled concurrency
	 * @param matches - Array of regex matches for HTML img tags
	 * @param maxConcurrency - Maximum number of concurrent image processing operations
	 * @param maxImageSize - Maximum image size in bytes
	 * @param enableCompression - Whether to enable image compression
	 * @param compressionQuality - Compression quality (0.1 to 1.0)
	 * @param progress - Progress tracking object
	 * @param onProgress - Progress callback function
	 * @returns Promise<ImageProcessingResult[]> - Array of processing results
	 */
	private async processHtmlImagesWithConcurrency(
		matches: RegExpMatchArray[],
		maxConcurrency: number,
		maxImageSize: number,
		enableCompression: boolean,
		compressionQuality: number,
		progress: ImageProcessingProgress,
		onProgress?: (progress: ImageProcessingProgress) => void
	): Promise<ImageProcessingResult[]> {
		const results: ImageProcessingResult[] = [];
		const semaphore = new Array(maxConcurrency).fill(null);
		let currentIndex = 0;

		// Process images in batches with controlled concurrency
		const processNextBatch = async (): Promise<void> => {
			const batch: Promise<void>[] = [];

			for (let i = 0; i < maxConcurrency && currentIndex < matches.length; i++) {
				const matchIndex = currentIndex++;
				const match = matches[matchIndex];
				const [originalHtmlTag, resourceId] = match;

				progress.current = `Processing HTML image ${matchIndex + 1}/${matches.length}`;
				onProgress?.(progress);

				const processPromise = this.processHtmlImageResourceOptimized(
					originalHtmlTag,
					resourceId,
					maxImageSize,
					enableCompression,
					compressionQuality
				).then(result => {
					results[matchIndex] = result;
					progress.processed++;
					if (!result.success) {
						progress.failed++;
					}
					onProgress?.(progress);
				}).catch(error => {
					// Handle unexpected errors
					const errorResult: ImageProcessingResult = {
						originalLink: originalHtmlTag,
						processedLink: this.createHtmlImagePlaceholder(originalHtmlTag, error.message),
						success: true, // Mark as success since we have a placeholder
						error: error.message,
						resourceId,
						isPlaceholder: true
					};
					results[matchIndex] = errorResult;
					progress.processed++;
					progress.failed++;
					onProgress?.(progress);
				});

				batch.push(processPromise);
			}

			if (batch.length > 0) {
				await Promise.all(batch);
			}
		};

		// Process all images in batches
		while (currentIndex < matches.length) {
			await processNextBatch();
		}

		// Ensure results array is complete (fill any gaps with placeholders)
		for (let i = 0; i < matches.length; i++) {
			if (!results[i]) {
				const [originalHtmlTag] = matches[i];
				results[i] = {
					originalLink: originalHtmlTag,
					processedLink: this.createHtmlImagePlaceholder(originalHtmlTag, 'Processing failed'),
					success: true,
					error: 'Processing failed',
					isPlaceholder: true
				};
			}
		}

		return results;
	}

	/**
	 * Process a single HTML image resource with caching, compression, and optimization
	 * @param originalHtmlTag - The original HTML img tag
	 * @param resourceId - Joplin resource ID
	 * @param maxImageSize - Maximum image size in bytes
	 * @param enableCompression - Whether to enable compression
	 * @param compressionQuality - Compression quality
	 * @returns Promise<ImageProcessingResult> - Processing result
	 */
	private async processHtmlImageResourceOptimized(
		originalHtmlTag: string,
		resourceId: string,
		maxImageSize: number,
		enableCompression: boolean,
		compressionQuality: number
	): Promise<ImageProcessingResult> {
		// Check cache first
		const cachedDataUri = this.imageCache.get(resourceId);
		if (cachedDataUri) {
			console.log(`Joplin Portal: Using cached image for HTML resource ${resourceId}`);

			// Extract and preserve attributes, then reconstruct HTML tag using the new method
			const attributes = this.extractHtmlImageAttributes(originalHtmlTag);
			const processedHtmlTag = this.reconstructHtmlImageTag(cachedDataUri, attributes);

			return {
				originalLink: originalHtmlTag,
				processedLink: processedHtmlTag,
				success: true,
				resourceId,
				fromCache: true
			};
		}

		// Process with retry logic
		const retryConfig = {
			maxRetries: 2,
			baseDelay: 500,
			maxDelay: 5000,
			backoffMultiplier: 2
		};

		try {
			return await RetryUtility.executeWithRetry(
				async () => {
					return await this.processHtmlImageResourceInternal(
						originalHtmlTag,
						resourceId,
						maxImageSize,
						enableCompression,
						compressionQuality
					);
				},
				retryConfig,
				`Process optimized HTML image resource ${resourceId}`
			);
		} catch (error) {
			// If all retries failed, create a placeholder result
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			console.warn(`Joplin Portal: Failed to process HTML image resource ${resourceId} after retries: ${errorMessage}`);

			return {
				originalLink: originalHtmlTag,
				processedLink: this.createHtmlImagePlaceholder(originalHtmlTag, errorMessage),
				success: true, // Mark as success since we have a placeholder
				error: errorMessage,
				resourceId,
				retryCount: retryConfig.maxRetries,
				isPlaceholder: true
			};
		}
	}

	/**
	 * Internal method to process HTML image resource
	 * @param originalHtmlTag - The original HTML img tag
	 * @param resourceId - Joplin resource ID
	 * @param maxImageSize - Maximum image size in bytes
	 * @param enableCompression - Whether to enable compression
	 * @param compressionQuality - Compression quality
	 * @returns Promise<ImageProcessingResult> - Processing result
	 */
	private async processHtmlImageResourceInternal(
		originalHtmlTag: string,
		resourceId: string,
		maxImageSize: number,
		enableCompression: boolean,
		compressionQuality: number
	): Promise<ImageProcessingResult> {
		// Get resource metadata to check if it's an image and get MIME type
		const metadata = await this.getResourceMetadata(resourceId);

		if (!metadata) {
			throw new Error('Resource metadata not found - resource may have been deleted');
		}

		// Check if the resource is an image
		if (!metadata.mime.startsWith('image/')) {
			console.log(`Joplin Portal: HTML resource ${resourceId} is not an image (${metadata.mime}), preserving original tag`);
			return {
				originalLink: originalHtmlTag,
				processedLink: originalHtmlTag,
				success: true,
				resourceId,
				mimeType: metadata.mime,
				retryCount: 0
			};
		}

		// Check image size before downloading
		if (metadata.size > maxImageSize) {
			console.warn(`Joplin Portal: HTML image ${resourceId} is too large (${Math.round(metadata.size / 1024 / 1024)}MB), creating placeholder`);
			return {
				originalLink: originalHtmlTag,
				processedLink: this.createHtmlImagePlaceholder(originalHtmlTag, `Image too large (${Math.round(metadata.size / 1024 / 1024)}MB)`),
				success: true,
				resourceId,
				mimeType: metadata.mime,
				retryCount: 0,
				isPlaceholder: true
			};
		}

		// Get the raw image data
		const imageData = await this.getResourceFile(resourceId);

		if (!imageData) {
			throw new Error('Resource file data not found - file may be corrupted or inaccessible');
		}

		try {
			// Convert ArrayBuffer to base64
			const base64String = this.arrayBufferToBase64(imageData);
			let dataUri = `data:${metadata.mime};base64,${base64String}`;

			// Apply compression if enabled and image is large
			if (enableCompression && ImageCompression.shouldCompress(dataUri)) {
				console.log(`Joplin Portal: Compressing large HTML image ${resourceId}`);

				const compressionOptions: CompressionOptions = {
					quality: compressionQuality,
					maxWidth: 1920,
					maxHeight: 1080,
					format: metadata.mime.includes('png') ? 'png' : 'jpeg'
				};

				const compressionResult = await ImageCompression.compressImage(dataUri, compressionOptions);

				if (compressionResult.wasCompressed) {
					dataUri = compressionResult.compressedDataUri;
					console.log(`Joplin Portal: Compressed HTML image ${resourceId} by ${Math.round((1 - compressionResult.compressionRatio) * 100)}%`);
				}
			}

			// Cache the processed image
			this.imageCache.set(resourceId, dataUri, metadata.mime);

			// Extract and preserve attributes, then reconstruct HTML tag using the new method
			const attributes = this.extractHtmlImageAttributes(originalHtmlTag);
			const processedHtmlTag = this.reconstructHtmlImageTag(dataUri, attributes);

			return {
				originalLink: originalHtmlTag,
				processedLink: processedHtmlTag,
				success: true,
				resourceId,
				mimeType: metadata.mime,
				retryCount: 0
			};
		} catch (error) {
			throw new Error(`Failed to convert HTML image to base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Convert ArrayBuffer to base64 string with error handling
	 * @param buffer - ArrayBuffer containing binary data
	 * @returns string - Base64 encoded string
	 */
	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		try {
			if (!buffer || buffer.byteLength === 0) {
				throw new Error('Empty or invalid buffer provided');
			}

			const bytes = new Uint8Array(buffer);
			let binary = '';

			// Process in chunks to avoid call stack size exceeded error for large images
			const chunkSize = 8192;
			for (let i = 0; i < bytes.length; i += chunkSize) {
				const chunk = bytes.subarray(i, i + chunkSize);
				try {
					binary += String.fromCharCode.apply(null, Array.from(chunk));
				} catch (chunkError) {
					// If chunk processing fails, try smaller chunks
					for (let j = 0; j < chunk.length; j++) {
						binary += String.fromCharCode(chunk[j]);
					}
				}
			}

			const base64Result = btoa(binary);

			// Validate the result
			if (!base64Result || base64Result.length === 0) {
				throw new Error('Base64 conversion resulted in empty string');
			}

			return base64Result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error(`Joplin Portal: Failed to convert ArrayBuffer to base64: ${errorMessage}`);
			throw new Error(`Base64 conversion failed: ${errorMessage}`);
		}
	}
}