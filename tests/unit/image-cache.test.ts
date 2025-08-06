/**
 * Tests for ImageCache class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImageCache } from '../../src/image-cache';

describe('ImageCache', () => {
	let imageCache: ImageCache;

	beforeEach(() => {
		imageCache = new ImageCache(5, 1, 1); // 5 images, 1MB, 1 minute
	});

	describe('basic operations', () => {
		it('should store and retrieve images', () => {
			const resourceId = 'test-resource-123';
			const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==';
			const mimeType = 'image/png';

			imageCache.set(resourceId, dataUri, mimeType);
			const retrieved = imageCache.get(resourceId);

			expect(retrieved).toBe(dataUri);
		});

		it('should return null for non-existent images', () => {
			const result = imageCache.get('non-existent');
			expect(result).toBeNull();
		});

		it('should check if image exists', () => {
			const resourceId = 'test-resource-456';
			const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A';

			expect(imageCache.has(resourceId)).toBe(false);

			imageCache.set(resourceId, dataUri, 'image/jpeg');

			expect(imageCache.has(resourceId)).toBe(true);
		});

		it('should clear all cached images', () => {
			imageCache.set('resource1', 'data:image/png;base64,test1', 'image/png');
			imageCache.set('resource2', 'data:image/png;base64,test2', 'image/png');

			expect(imageCache.has('resource1')).toBe(true);
			expect(imageCache.has('resource2')).toBe(true);

			imageCache.clear();

			expect(imageCache.has('resource1')).toBe(false);
			expect(imageCache.has('resource2')).toBe(false);
		});
	});

	describe('cache limits', () => {
		it('should evict oldest entries when size limit is reached', () => {
			// Fill cache to capacity
			for (let i = 0; i < 5; i++) {
				imageCache.set(`resource${i}`, `data:image/png;base64,test${i}`, 'image/png');
			}

			// All should be present
			for (let i = 0; i < 5; i++) {
				expect(imageCache.has(`resource${i}`)).toBe(true);
			}

			// Add one more to trigger eviction
			imageCache.set('resource5', 'data:image/png;base64,test5', 'image/png');

			// First entry should be evicted
			expect(imageCache.has('resource0')).toBe(false);
			expect(imageCache.has('resource5')).toBe(true);
		});

		it('should not cache extremely large images', () => {
			const resourceId = 'large-image';
			// Create a large base64 string (simulating a large image)
			const largeDataUri = 'data:image/png;base64,' + 'A'.repeat(1024 * 1024); // 1MB base64

			imageCache.set(resourceId, largeDataUri, 'image/png');

			// Should not be cached due to size limit
			expect(imageCache.has(resourceId)).toBe(false);
		});
	});

	describe('LRU behavior', () => {
		it('should move accessed items to end (most recently used)', () => {
			// Fill cache
			imageCache.set('resource1', 'data:image/png;base64,test1', 'image/png');
			imageCache.set('resource2', 'data:image/png;base64,test2', 'image/png');
			imageCache.set('resource3', 'data:image/png;base64,test3', 'image/png');

			// Access resource1 to make it most recently used
			imageCache.get('resource1');

			// Fill remaining slots
			imageCache.set('resource4', 'data:image/png;base64,test4', 'image/png');
			imageCache.set('resource5', 'data:image/png;base64,test5', 'image/png');

			// Add one more to trigger eviction
			imageCache.set('resource6', 'data:image/png;base64,test6', 'image/png');

			// resource2 should be evicted (oldest unused), resource1 should remain
			expect(imageCache.has('resource1')).toBe(true);
			expect(imageCache.has('resource2')).toBe(false);
			expect(imageCache.has('resource6')).toBe(true);
		});
	});

	describe('statistics', () => {
		it('should track cache statistics', () => {
			const stats = imageCache.getStats();
			expect(stats.hits).toBe(0);
			expect(stats.misses).toBe(0);
			expect(stats.size).toBe(0);

			// Add an item
			imageCache.set('resource1', 'data:image/png;base64,test1', 'image/png');

			// Cache miss
			imageCache.get('non-existent');
			expect(imageCache.getStats().misses).toBe(1);

			// Cache hit
			imageCache.get('resource1');
			expect(imageCache.getStats().hits).toBe(1);
		});

		it('should calculate hit ratio', () => {
			expect(imageCache.getHitRatio()).toBe(0);

			imageCache.set('resource1', 'data:image/png;base64,test1', 'image/png');

			// 1 miss
			imageCache.get('non-existent');
			expect(imageCache.getHitRatio()).toBe(0);

			// 1 hit, 1 miss = 50%
			imageCache.get('resource1');
			expect(imageCache.getHitRatio()).toBe(50);
		});
	});

	describe('TTL (Time To Live)', () => {
		it('should expire entries after TTL', async () => {
			// Use a very short TTL for testing
			const shortTtlCache = new ImageCache(5, 1, 0.001); // 0.001 minutes = 0.06 seconds

			shortTtlCache.set('resource1', 'data:image/png;base64,test1', 'image/png');
			expect(shortTtlCache.has('resource1')).toBe(true);

			// Wait for expiration
			await new Promise(resolve => setTimeout(resolve, 100));

			expect(shortTtlCache.has('resource1')).toBe(false);
		});
	});

	describe('maintenance', () => {
		it('should perform cache maintenance', () => {
			// Fill cache
			for (let i = 0; i < 5; i++) {
				imageCache.set(`resource${i}`, `data:image/png;base64,test${i}`, 'image/png');
			}

			const statsBefore = imageCache.getStats();
			expect(statsBefore.size).toBe(5);

			// Perform maintenance (should clean up if needed)
			imageCache.performMaintenance();

			// Size should remain the same if no cleanup was needed
			const statsAfter = imageCache.getStats();
			expect(statsAfter.size).toBeLessThanOrEqual(5);
		});
	});
});