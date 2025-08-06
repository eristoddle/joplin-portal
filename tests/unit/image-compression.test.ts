/**
 * Tests for ImageCompression class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImageCompression } from '../../src/image-compression';

// Mock DOM APIs for testing
const mockCanvas = {
	width: 0,
	height: 0,
	getContext: vi.fn(() => ({
		drawImage: vi.fn()
	})),
	toDataURL: vi.fn(() => 'data:image/jpeg;base64,compressed'),
	remove: vi.fn()
};

const mockImage = {
	width: 1920,
	height: 1080,
	onload: null as any,
	onerror: null as any,
	src: ''
};

// Mock document.createElement
Object.defineProperty(global, 'document', {
	value: {
		createElement: vi.fn((tagName: string) => {
			if (tagName === 'canvas') {
				return mockCanvas;
			}
			return {};
		})
	}
});

// Mock Image constructor
Object.defineProperty(global, 'Image', {
	value: vi.fn(() => mockImage)
});

describe('ImageCompression', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCanvas.width = 0;
		mockCanvas.height = 0;
		mockImage.width = 1920;
		mockImage.height = 1080;
	});

	describe('shouldCompress', () => {
		it('should return true for large images', () => {
			const largeDataUri = 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024); // 3MB
			expect(ImageCompression.shouldCompress(largeDataUri)).toBe(true);
		});

		it('should return false for small images', () => {
			const smallDataUri = 'data:image/png;base64,smallimage';
			expect(ImageCompression.shouldCompress(smallDataUri)).toBe(false);
		});

		it('should use custom size threshold', () => {
			const dataUri = 'data:image/png;base64,' + 'A'.repeat(1024); // 1KB
			expect(ImageCompression.shouldCompress(dataUri, 500)).toBe(true);
			expect(ImageCompression.shouldCompress(dataUri, 2000)).toBe(false);
		});
	});

	describe('compressImage', () => {
		it('should not compress small images', async () => {
			const smallDataUri = 'data:image/png;base64,smallimage';

			const result = await ImageCompression.compressImage(smallDataUri);

			expect(result.wasCompressed).toBe(false);
			expect(result.compressedDataUri).toBe(smallDataUri);
			expect(result.compressionRatio).toBe(1);
		});

		it('should compress large images', async () => {
			const largeDataUri = 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024); // 3MB

			// Mock successful image loading
			setTimeout(() => {
				if (mockImage.onload) {
					mockImage.onload();
				}
			}, 0);

			const result = await ImageCompression.compressImage(largeDataUri);

			expect(result.wasCompressed).toBe(true);
			expect(result.compressedDataUri).toBe('data:image/jpeg;base64,compressed');
			expect(mockCanvas.getContext).toHaveBeenCalled();
		});

		it('should handle compression errors gracefully', async () => {
			const largeDataUri = 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024);

			// Mock image loading error
			setTimeout(() => {
				if (mockImage.onerror) {
					mockImage.onerror(new Error('Failed to load'));
				}
			}, 0);

			const result = await ImageCompression.compressImage(largeDataUri);

			expect(result.wasCompressed).toBe(false);
			expect(result.compressedDataUri).toBe(largeDataUri);
		});

		it('should use custom compression options', async () => {
			const largeDataUri = 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024);

			setTimeout(() => {
				if (mockImage.onload) {
					mockImage.onload();
				}
			}, 0);

			const options = {
				maxWidth: 800,
				maxHeight: 600,
				quality: 0.5,
				format: 'webp' as const
			};

			await ImageCompression.compressImage(largeDataUri, options);

			expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/webp', 0.5);
		});
	});

	describe('getImageDimensions', () => {
		it('should return image dimensions', async () => {
			mockImage.width = 800;
			mockImage.height = 600;

			setTimeout(() => {
				if (mockImage.onload) {
					mockImage.onload();
				}
			}, 0);

			const dimensions = await ImageCompression.getImageDimensions('data:image/png;base64,test');

			expect(dimensions.width).toBe(800);
			expect(dimensions.height).toBe(600);
		});

		it('should handle dimension errors gracefully', async () => {
			setTimeout(() => {
				if (mockImage.onerror) {
					mockImage.onerror(new Error('Failed to load'));
				}
			}, 0);

			const dimensions = await ImageCompression.getImageDimensions('data:image/png;base64,test');

			expect(dimensions.width).toBe(0);
			expect(dimensions.height).toBe(0);
		});
	});
});