import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportService } from '../../src/import-service';
import { JoplinResource } from '../../src/types';

// Mock Obsidian
const mockApp = {
	vault: {
		getConfig: vi.fn().mockReturnValue('attachments'),
		getAbstractFileByPath: vi.fn().mockReturnValue(null),
		createFolder: vi.fn().mockResolvedValue({ path: 'attachments' }),
		createBinary: vi.fn().mockResolvedValue({ path: 'attachments/test-image.jpg' })
	}
};

// Mock Joplin API Service
const mockJoplinApiService = {
	getResourceMetadata: vi.fn(),
	getResourceFile: vi.fn()
};

// Mock console methods to avoid noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('ImportService - Image Download Functionality (Task 24)', () => {
	let importService: ImportService;

	beforeEach(() => {
		vi.clearAllMocks();
		importService = new ImportService(mockApp as any, mockJoplinApiService as any);
	});

	describe('downloadAndStoreImages', () => {
		const mockResource: JoplinResource = {
			id: 'abc123def45678901234567890123456',
			title: 'test-image',
			mime: 'image/jpeg',
			filename: 'test-image.jpg',
			file_extension: 'jpg',
			created_time: Date.now(),
			updated_time: Date.now(),
			user_created_time: Date.now(),
			user_updated_time: Date.now(),
			encryption_cipher_text: '',
			encryption_applied: 0,
			encryption_blob_encrypted: 0,
			size: 1024
		};

		const mockImageData = new ArrayBuffer(1024);

		it('should download and store images successfully', async () => {
			const noteBody = 'Here is an image: ![Test Image](:/abc123def45678901234567890123456)';

			mockJoplinApiService.getResourceMetadata.mockResolvedValue(mockResource);
			mockJoplinApiService.getResourceFile.mockResolvedValue(mockImageData);
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			const result = await importService.downloadAndStoreImages(noteBody, 'attachments');

			expect(result.imageResults).toHaveLength(1);
			expect(result.imageResults[0].success).toBe(true);
			expect(result.imageResults[0].resourceId).toBe('abc123def45678901234567890123456');
			expect(result.imageResults[0].localFilename).toBe('test-image.jpg');
			expect(result.processedBody).toContain('![Test Image](test-image.jpg)');
		});

		it('should handle notes with no images', async () => {
			const noteBody = 'This is a note with no images.';

			const result = await importService.downloadAndStoreImages(noteBody, 'attachments');

			expect(result.imageResults).toHaveLength(0);
			expect(result.processedBody).toBe(noteBody);
		});

		it('should handle API service not available', async () => {
			const importServiceWithoutApi = new ImportService(mockApp as any);
			const noteBody = 'Here is an image: ![Test Image](:/abc123def45678901234567890123456)';

			await expect(importServiceWithoutApi.downloadAndStoreImages(noteBody, 'attachments'))
				.rejects.toThrow('Joplin API service is not available for image downloads');
		});

		it('should handle failed image downloads gracefully', async () => {
			const noteBody = 'Here is an image: ![Test Image](:/abc123def45678901234567890123456)';

			mockJoplinApiService.getResourceMetadata.mockRejectedValue(new Error('Network error'));

			const result = await importService.downloadAndStoreImages(noteBody, 'attachments');

			expect(result.imageResults).toHaveLength(1);
			expect(result.imageResults[0].success).toBe(false);
			expect(result.imageResults[0].error).toContain('Network error');
			expect(result.processedBody).toContain('<!-- Warning: Failed to download image');
		});

		it('should skip non-image resources', async () => {
			const noteBody = 'Here is a document: ![Document](:/abc123def45678901234567890123456)';
			const nonImageResource = { ...mockResource, mime: 'application/pdf' };

			mockJoplinApiService.getResourceMetadata.mockResolvedValue(nonImageResource);

			const result = await importService.downloadAndStoreImages(noteBody, 'attachments');

			expect(result.imageResults).toHaveLength(0);
			expect(result.processedBody).toBe(noteBody); // Should remain unchanged
		});
	});

	describe('generateUniqueFilename', () => {
		it('should return original filename when no conflict', async () => {
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			const result = await importService.generateUniqueFilename('test-image', '.jpg', 'attachments');
			expect(result).toBe('test-image.jpg');
		});

		it('should generate unique filename when conflict exists', async () => {
			mockApp.vault.getAbstractFileByPath
				.mockReturnValueOnce({ path: 'attachments/test-image.jpg' })
				.mockReturnValueOnce({ path: 'attachments/test-image-1.jpg' })
				.mockReturnValueOnce(null);

			const result = await importService.generateUniqueFilename('test-image', '.jpg', 'attachments');
			expect(result).toBe('test-image-2.jpg');
		});
	});
});