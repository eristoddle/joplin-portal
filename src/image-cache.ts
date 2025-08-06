/**
 * Image processing cache for improved performance
 * Implements LRU cache with TTL and size limits for processed images
 */

import { ImageCacheEntry } from './types';

interface ImageCacheStats {
	hits: number;
	misses: number;
	evictions: number;
	size: number;
	totalSizeBytes: number;
}

export class ImageCache {
	private cache = new Map<string, ImageCacheEntry>();
	private maxSize: number;
	private maxSizeBytes: number;
	private ttlMs: number;
	private stats: ImageCacheStats = {
		hits: 0,
		misses: 0,
		evictions: 0,
		size: 0,
		totalSizeBytes: 0
	};

	constructor(
		maxSize = 100, // Maximum number of cached images
		maxSizeMB = 50, // Maximum total cache size in MB
		ttlMinutes = 30 // Cache TTL in minutes
	) {
		this.maxSize = maxSize;
		this.maxSizeBytes = maxSizeMB * 1024 * 1024;
		this.ttlMs = ttlMinutes * 60 * 1000;
	}

	/**
	 * Check if cache entry is still valid (not expired)
	 */
	private isValid(entry: ImageCacheEntry): boolean {
		return Date.now() - entry.timestamp < this.ttlMs;
	}

	/**
	 * Calculate the approximate size of a data URI in bytes
	 */
	private calculateDataUriSize(dataUri: string): number {
		// Base64 encoding increases size by ~33%, plus metadata overhead
		const base64Part = dataUri.split(',')[1] || '';
		return Math.ceil(base64Part.length * 0.75); // Approximate original size
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

		expiredKeys.forEach(key => this.evictEntry(key));
	}

	/**
	 * Evict a specific entry and update stats
	 */
	private evictEntry(key: string): void {
		const entry = this.cache.get(key);
		if (entry) {
			this.cache.delete(key);
			this.stats.evictions++;
			this.stats.size = this.cache.size;
			this.stats.totalSizeBytes -= entry.size;
		}
	}

	/**
	 * Evict least recently used entries if cache is full or over size limit
	 */
	private evictLRU(): void {
		// Evict by count limit
		while (this.cache.size >= this.maxSize) {
			const firstKey = this.cache.keys().next().value;
			if (firstKey) {
				this.evictEntry(firstKey);
			} else {
				break;
			}
		}

		// Evict by size limit
		while (this.stats.totalSizeBytes > this.maxSizeBytes) {
			const firstKey = this.cache.keys().next().value;
			if (firstKey) {
				this.evictEntry(firstKey);
			} else {
				break;
			}
		}
	}

	/**
	 * Get cached image data URI if available and valid
	 */
	get(resourceId: string): string | null {
		if (!resourceId) {
			return null;
		}

		this.cleanExpired();

		const entry = this.cache.get(resourceId);

		if (entry && this.isValid(entry)) {
			// Move to end (mark as recently used)
			this.cache.delete(resourceId);
			this.cache.set(resourceId, entry);

			this.stats.hits++;
			return entry.dataUri;
		}

		this.stats.misses++;
		return null;
	}

	/**
	 * Store processed image in cache
	 */
	set(resourceId: string, dataUri: string, mimeType: string): void {
		if (!resourceId || !dataUri) {
			return;
		}

		this.cleanExpired();

		const size = this.calculateDataUriSize(dataUri);

		// Don't cache extremely large images
		const maxSingleImageSize = this.maxSizeBytes * 0.2; // Max 20% of total cache size
		if (size > maxSingleImageSize) {
			console.warn(`Joplin Portal: Image ${resourceId} too large for cache (${Math.round(size / 1024 / 1024)}MB)`);
			return;
		}

		this.evictLRU();

		const entry: ImageCacheEntry = {
			dataUri,
			mimeType,
			size,
			timestamp: Date.now(),
			resourceId
		};

		this.cache.set(resourceId, entry);
		this.stats.size = this.cache.size;
		this.stats.totalSizeBytes += size;
	}

	/**
	 * Check if image is cached and valid
	 */
	has(resourceId: string): boolean {
		if (!resourceId) {
			return false;
		}

		const entry = this.cache.get(resourceId);
		return entry ? this.isValid(entry) : false;
	}

	/**
	 * Clear all cached images
	 */
	clear(): void {
		this.cache.clear();
		this.stats = {
			hits: 0,
			misses: 0,
			evictions: 0,
			size: 0,
			totalSizeBytes: 0
		};
	}

	/**
	 * Get cache statistics for debugging
	 */
	getStats(): ImageCacheStats {
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
	 * Get cache size in MB
	 */
	getSizeMB(): number {
		return this.stats.totalSizeBytes / (1024 * 1024);
	}

	/**
	 * Remove specific image from cache
	 */
	remove(resourceId: string): void {
		this.evictEntry(resourceId);
	}

	/**
	 * Get all cached resource IDs for debugging
	 */
	getCachedResourceIds(): string[] {
		this.cleanExpired();
		return Array.from(this.cache.keys());
	}

	/**
	 * Preemptively clean cache to maintain performance
	 */
	performMaintenance(): void {
		this.cleanExpired();

		// If cache is getting full, be more aggressive with eviction
		if (this.cache.size > this.maxSize * 0.8 || this.stats.totalSizeBytes > this.maxSizeBytes * 0.8) {
			// Evict oldest 10% of entries
			const entriesToEvict = Math.floor(this.cache.size * 0.1);
			const keys = Array.from(this.cache.keys());

			for (let i = 0; i < entriesToEvict && i < keys.length; i++) {
				this.evictEntry(keys[i]);
			}
		}
	}
}