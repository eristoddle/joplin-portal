/**
 * Image compression utilities for optimizing large images
 */

export interface CompressionOptions {
	maxWidth?: number;
	maxHeight?: number;
	quality?: number; // 0.1 to 1.0
	format?: 'jpeg' | 'webp' | 'png';
}

export interface CompressionResult {
	compressedDataUri: string;
	originalSize: number;
	compressedSize: number;
	compressionRatio: number;
	wasCompressed: boolean;
}

export class ImageCompression {
	/**
	 * Compress an image data URI if it exceeds size limits
	 */
	static async compressImage(
		dataUri: string,
		options: CompressionOptions = {}
	): Promise<CompressionResult> {
		const {
			maxWidth = 1920,
			maxHeight = 1080,
			quality = 0.8,
			format = 'jpeg'
		} = options;

		const originalSize = ImageCompression.calculateDataUriSize(dataUri);

		// If image is already small enough, don't compress
		const maxSizeBytes = 2 * 1024 * 1024; // 2MB threshold
		if (originalSize <= maxSizeBytes) {
			return {
				compressedDataUri: dataUri,
				originalSize,
				compressedSize: originalSize,
				compressionRatio: 1,
				wasCompressed: false
			};
		}

		try {
			// Create canvas for image processing
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			if (!ctx) {
				throw new Error('Canvas context not available');
			}

			// Load image
			const img = await ImageCompression.loadImage(dataUri);

			// Calculate new dimensions while maintaining aspect ratio
			const { width: newWidth, height: newHeight } = ImageCompression.calculateDimensions(
				img.width,
				img.height,
				maxWidth,
				maxHeight
			);

			// Set canvas size
			canvas.width = newWidth;
			canvas.height = newHeight;

			// Draw and compress image
			ctx.drawImage(img, 0, 0, newWidth, newHeight);

			// Convert to compressed format
			const mimeType = `image/${format}`;
			const compressedDataUri = canvas.toDataURL(mimeType, quality);
			const compressedSize = ImageCompression.calculateDataUriSize(compressedDataUri);

			// Clean up
			canvas.remove();

			return {
				compressedDataUri,
				originalSize,
				compressedSize,
				compressionRatio: compressedSize / originalSize,
				wasCompressed: true
			};
		} catch (error) {
			console.warn('Joplin Portal: Image compression failed, using original:', error);

			// Return original if compression fails
			return {
				compressedDataUri: dataUri,
				originalSize,
				compressedSize: originalSize,
				compressionRatio: 1,
				wasCompressed: false
			};
		}
	}

	/**
	 * Load image from data URI
	 */
	private static loadImage(dataUri: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const img = new Image();

			img.onload = () => resolve(img);
			img.onerror = (error) => reject(new Error(`Failed to load image: ${error}`));

			img.src = dataUri;
		});
	}

	/**
	 * Calculate new dimensions while maintaining aspect ratio
	 */
	private static calculateDimensions(
		originalWidth: number,
		originalHeight: number,
		maxWidth: number,
		maxHeight: number
	): { width: number; height: number } {
		let { width, height } = { width: originalWidth, height: originalHeight };

		// Calculate scaling factor
		const widthRatio = maxWidth / width;
		const heightRatio = maxHeight / height;
		const scalingFactor = Math.min(widthRatio, heightRatio, 1); // Don't upscale

		width = Math.floor(width * scalingFactor);
		height = Math.floor(height * scalingFactor);

		return { width, height };
	}

	/**
	 * Calculate the approximate size of a data URI in bytes
	 */
	private static calculateDataUriSize(dataUri: string): number {
		const base64Part = dataUri.split(',')[1] || '';
		return Math.ceil(base64Part.length * 0.75); // Approximate original size
	}

	/**
	 * Check if image should be compressed based on size and dimensions
	 */
	static shouldCompress(
		dataUri: string,
		maxSizeBytes = 2 * 1024 * 1024 // 2MB
	): boolean {
		const size = ImageCompression.calculateDataUriSize(dataUri);
		return size > maxSizeBytes;
	}

	/**
	 * Get image dimensions from data URI
	 */
	static async getImageDimensions(dataUri: string): Promise<{ width: number; height: number }> {
		try {
			const img = await ImageCompression.loadImage(dataUri);
			return { width: img.width, height: img.height };
		} catch (error) {
			console.warn('Joplin Portal: Failed to get image dimensions:', error);
			return { width: 0, height: 0 };
		}
	}
}