/**
 * Search result caching utility for improved performance
 * Implements LRU cache with TTL (time-to-live) for search results
 */

import { SearchResult } from './types';

interface CacheEntry {
	results: SearchResult[];
	timestamp: number;
	query: string;
	options?: any;
}

interface CacheStats {
	hits: number;
	misses: number;
	evictions: number;
	size: number;
}

export class SearchCache {
	private cache = new Map<string, CacheEntry>();
	private maxSize: number;
	private ttlMs: number;
	private stats: CacheStats = {
		hits: 0,
		misses: 0,
		evictions: 0,
		size: 0
	};

	constructor(maxSize = 50, ttlMinutes = 10) {
		this.maxSize = maxSize;
		this.ttlMs = ttlMinutes * 60 * 1000;
	}

	/**
	 * Generate cache key from query and options
	 */
	private generateKey(query: string, options?: any): string {
		const normalizedQuery = query.toLowerCase().trim();
		const optionsStr = options ? JSON.stringify(options) : '';
		return `${normalizedQuery}|${optionsStr}`;
	}

	/**
	 * Check if cache entry is still valid (not expired)
	 */
	private isValid(entry: CacheEntry): boolean {
		return Date.now() - entry.timestamp < this.ttlMs;
	}

	/**
	 * Clean expired entries from cache
	 */
	private cleanExpired(): void {
		const now = Date.now();
		const expiredKeys: string[] = [];

		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.timestamp >= this.ttlMs) {
				expiredKeys.push(key);
			}
		}

		expiredKeys.forEach(key => {
			this.cache.delete(key);
			this.stats.evictions++;
		});

		this.stats.size = this.cache.size;
	}

	/**
	 * Evict least recently used entries if cache is full
	 */
	private evictLRU(): void {
		if (this.cache.size < this.maxSize) {
			return;
		}

		// Find oldest entry (Map maintains insertion order)
		const firstKey = this.cache.keys().next().value;
		if (firstKey) {
			this.cache.delete(firstKey);
			this.stats.evictions++;
		}

		this.stats.size = this.cache.size;
	}

	/**
	 * Get cached search results if available and valid
	 */
	get(query: string, options?: any): SearchResult[] | null {
		if (!query.trim()) {
			return null;
		}

		this.cleanExpired();

		const key = this.generateKey(query, options);
		const entry = this.cache.get(key);

		if (entry && this.isValid(entry)) {
			// Move to end (mark as recently used)
			this.cache.delete(key);
			this.cache.set(key, entry);

			this.stats.hits++;
			return [...entry.results]; // Return copy to prevent mutation
		}

		this.stats.misses++;
		return null;
	}

	/**
	 * Store search results in cache
	 */
	set(query: string, results: SearchResult[], options?: any): void {
		if (!query.trim()) {
			return;
		}

		this.cleanExpired();
		this.evictLRU();

		const key = this.generateKey(query, options);
		const entry: CacheEntry = {
			results: [...results], // Store copy to prevent mutation
			timestamp: Date.now(),
			query: query.trim(),
			options
		};

		this.cache.set(key, entry);
		this.stats.size = this.cache.size;
	}

	/**
	 * Check if query results are cached and valid
	 */
	has(query: string, options?: any): boolean {
		if (!query.trim()) {
			return false;
		}

		const key = this.generateKey(query, options);
		const entry = this.cache.get(key);
		return entry ? this.isValid(entry) : false;
	}

	/**
	 * Clear all cached results
	 */
	clear(): void {
		this.cache.clear();
		this.stats = {
			hits: 0,
			misses: 0,
			evictions: 0,
			size: 0
		};
	}

	/**
	 * Get cache statistics for debugging
	 */
	getStats(): CacheStats {
		this.cleanExpired();
		return { ...this.stats };
	}

	/**
	 * Get cache hit ratio as percentage
	 */
	getHitRatio(): number {
		const total = this.stats.hits + this.stats.misses;
		return total > 0 ? (this.stats.hits / total) * 100 : 0;
	}

	/**
	 * Invalidate cache entries that might be affected by new data
	 * This is useful when notes are imported or modified
	 */
	invalidateRelated(keywords: string[]): void {
		const keysToDelete: string[] = [];

		for (const [key, entry] of this.cache.entries()) {
			const queryLower = entry.query.toLowerCase();

			// Check if any keyword appears in the cached query
			const shouldInvalidate = keywords.some(keyword =>
				queryLower.includes(keyword.toLowerCase())
			);

			if (shouldInvalidate) {
				keysToDelete.push(key);
			}
		}

		keysToDelete.forEach(key => {
			this.cache.delete(key);
			this.stats.evictions++;
		});

		this.stats.size = this.cache.size;
	}

	/**
	 * Get all cached queries for debugging
	 */
	getCachedQueries(): string[] {
		this.cleanExpired();
		return Array.from(this.cache.values()).map(entry => entry.query);
	}
}