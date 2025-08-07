import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportService } from '../../src/import-service';
import { JoplinResource, ImageImportResult, ImageDownloadProgress } from '../../src/types';

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
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('ImportService - Image Import Functionality (Task 26)', () => {
	let importService: ImportService;

	beforeEach(() => {
		vi.clearAllMocks();
		importService = new ImportService(mockApp as any, mockJoplinApiService as any);
	});

	describe('Image format support', () => {
		const testFormats = [
			{ mime: 'image/png', extension: 'png', filename: 'test-image.png' },
			{ mime: 'image/jpeg', extension: 'jpg', filename: 'test-image.jpg' },
			{ mime: 'image/gif', extension: 'gif', filename: 'test-image.gif' },
			{ mime: 'image/webp', extension: 'webp', filename: 'test-image.webp' }
		];

		testFormats.forEach(({ mime, extension, filename }) => {
			it(`should download and store ${extension.toUpperCase()} images correctly`, async () => {
				const noteBody = `Here is a ${extension.toUpperCase()} image: ![Test Image](:/abc123def45678901234567890123456)`;
				const mockResource: JoplinResource = {
					id: 'abc123def45678901234567890123456',
					title: `test-image`,
					mime,
					filename,
					file_extension: extension,
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

				mockJoplinApiService.getResourceMetadata.mockResolvedValue(mockResource);
				mockJoplinApiService.getResourceFile.mockResolvedValue(mockImageData);
				mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

				const result = await importService.downloadAndStoreImages(noteBody, 'attachments');

				expect(result.imageResults).toHaveLength(1);
				expect(result.imageResults[0].success).toBe(true);
				expect(result.imageResults[0].resourceId).toBe('abc123def45678901234567890123456');
				expect(result.imageResults[0].localFilename).toBe(filename);
				expect(result.processedBody).toContain(`![Test Image](${filename})`);
				expect(mockApp.vault.createBinary).toHaveBeenCalledWith(
					`attachments/${filename}`,
					expect.any(Uint8Array)
				);
			});
		});
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

		it('should download and store multiple images', async () => {
			const noteBody = `
				First image: ![Image 1](:/abc123def45678901234567890123456)
				Second image: ![Image 2](:/def456abc78901234567890123456789)
			`;

			const mockResource2 = { ...mockResource, id: 'def456abc78901234567890123456789', filename: 'test-image-2.jpg' };

			mockJoplinApiService.getResourceMetadata
				.mockResolvedValueOnce(mockResource)
				.mockResolvedValueOnce(mockResource2);
			mockJoplinApiService.getResourceFile
				.mockResolvedValueOnce(mockImageData)
				.mockResolvedValueOnce(mockImageData);
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			const result = await importService.downloadAndStoreImages(noteBody, 'attachments');

			expect(result.imageResults).toHaveLength(2);
			expect(result.imageResults[0].success).toBe(true);
			expect(result.imageResults[1].success).toBe(true);
			expect(result.processedBody).toContain('![Image 1](test-image.jpg)');
			expect(result.processedBody).toContain('![Image 2](test-image-2.jpg)');
		});

		it('should handle filename conflicts by generating unique names', async () => {
			const noteBody = 'Here is an image: ![Test Image](:/abc123def45678901234567890123456)';

			mockJoplinApiService.getResourceMetadata.mockResolvedValue(mockResource);
			mockJoplinApiService.getResourceFile.mockResolvedValue(mockImageData);

			// Mock file conflict - first call returns existing file, second returns null
			mockApp.vault.getAbstractFileByPath
				.mockReturnValueOnce({ path: 'attachments/test-image.jpg' })
				.mockReturnValueOnce(null);

			const result = await importService.downloadAndStoreImages(noteBody, 'attachments');

			expect(result.imageResults).toHaveLength(1);
			expect(result.imageResults[0].success).toBe(true);
			expect(result.imageResults[0].localFilename).toBe('test-image-1.jpg');
			expect(result.processedBody).toContain('![Test Image](test-image-1.jpg)');
		});

		it('should handle progress callback', async () => {
			const noteBody = `
				![Image 1](:/abc123def45678901234567890123456)
				![Image 2](:/def456abc78901234567890123456789)
			`;

			const progressCallback = vi.fn();
			const mockResource2 = { ...mockResource, id: 'def456abc78901234567890123456789' };

			mockJoplinApiService.getResourceMetadata
				.mockResolvedValueOnce(mockResource)
				.mockResolvedValueOnce(mockResource2);
			mockJoplinApiService.getResourceFile
				.mockResolvedValueOnce(mockImageData)
				.mockResolvedValueOnce(mockImageData);
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			await importService.downloadAndStoreImages(noteBody, 'attachments', progressCallback);

			expect(progressCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					total: 2,
					downloaded: expect.any(Number),
					failed: expect.any(Number),
					current: expect.any(String)
				})
			);
		});

		it('should skip non-image resources', async () => {
			const noteBody = 'Here is a document: ![Document](:/abc123def45678901234567890123456)';
			const nonImageResource = { ...mockResource, mime: 'application/pdf' };

			mockJoplinApiService.getResourceMetadata.mockResolvedValue(nonImageResource);

			const result = await importService.downloadAndStoreImages(noteBody, 'attachments');

			expect(result.imageResults).toHaveLength(0);
			expect(result.processedBody).toBe(noteBody); // Should remain unchanged
			expect(mockJoplinApiService.getResourceFile).not.toHaveBeenCalled();
		});

		it('should handle failed image downloads gracefully', async () => {
			const noteBody = 'Here is an image: ![Failed Image](:/abc123def45678901234567890123456)';

			mockJoplinApiService.getResourceMetadata.mockRejectedValue(new Error('Network error'));

			const result = await importService.downloadAndStoreImages(noteBody, 'attachments');

			expect(result.imageResults).toHaveLength(1);
			expect(result.imageResults[0].success).toBe(false);
			expect(result.imageResults[0].error).toContain('Network error');
			expect(result.processedBody).toContain('<!-- Warning: Failed to download image');
			expect(result.processedBody).toContain('abc123def45678901234567890123456');
		});

		it('should handle missing resource metadata', async () => {
			const noteBody = 'Here is an image: ![Missing](:/abc123def45678901234567890123456)';

			mockJoplinApiService.getResourceMetadata.mockResolvedValue(null);

			const result = await importService.downloadAndStoreImages(noteBody, 'attachments');

			expect(result.imageResults).toHaveLength(1);
			expect(result.imageResults[0].success).toBe(false);
			expect(result.imageResults[0].error).toContain('Resource metadata not found');
		});

		it('should handle failed image file download', async () => {
			const noteBody = 'Here is an image: ![Failed Download](:/abc123def45678901234567890123456)';

			mockJoplinApiService.getResourceMetadata.mockResolvedValue(mockResource);
			mockJoplinApiService.getResourceFile.mockResolvedValue(null);

			const result = await importService.downloadAndStoreImages(noteBody, 'attachments');

			expect(result.imageResults).toHaveLength(1);
			expect(result.imageResults[0].success).toBe(false);
			expect(result.imageResults[0].error).toContain('Failed to download image data');
		});

		it('should create attachments folder if it does not exist', async () => {
			const noteBody = 'Here is an image: ![Test Image](:/abc123def45678901234567890123456)';

			mockJoplinApiService.getResourceMetadata.mockResolvedValue(mockResource);
			mockJoplinApiService.getResourceFile.mockResolvedValue(mockImageData);
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			await importService.downloadAndStoreImages(noteBody, 'new-attachments-folder');

			expect(mockApp.vault.createFolder).toHaveBeenCalledWith('new-attachments-folder');
		});

		it('should sanitize filenames properly', async () => {
			const noteBody = 'Here is an image: ![Test Image](:/abc123def45678901234567890123456)';
			const resourceWithBadFilename = {
				...mockResource,
				title: 'test<>image:with|bad*chars',
				filename: 'test<>image:with|bad*chars.jpg'
			};

			mockJoplinApiService.getResourceMetadata.mockResolvedValue(resourceWithBadFilename);
			mockJoplinApiService.getResourceFile.mockResolvedValue(mockImageData);
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			const result = await importService.downloadAndStoreImages(noteBody, 'attachments');

			expect(result.imageResults).toHaveLength(1);
			expect(result.imageResults[0].success).toBe(true);
			expect(result.imageResults[0].localFilename).toBe('test--image-with-bad-chars.jpg');
		});

		it('should handle resources without file extensions', async () => {
			const noteBody = 'Here is an image: ![No Extension](:/abc123def45678901234567890123456)';
			const resourceWithoutExtension = {
				...mockResource,
				filename: 'image-without-extension',
				file_extension: ''
			};

			mockJoplinApiService.getResourceMetadata.mockResolvedValue(resourceWithoutExtension);
			mockJoplinApiService.getResourceFile.mockResolvedValue(mockImageData);
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			const result = await importService.downloadAndStoreImages(noteBody, 'attachments');

			expect(result.imageResults).toHaveLength(1);
			expect(result.imageResults[0].success).toBe(true);
			expect(result.imageResults[0].localFilename).toBe('image-without-extension.jpg'); // Should get extension from MIME type
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

		it('should handle multiple conflicts', async () => {
			// Mock multiple existing files
			mockApp.vault.getAbstractFileByPath
				.mockReturnValueOnce({ path: 'attachments/test-image.jpg' })
				.mockReturnValueOnce({ path: 'attachments/test-image-1.jpg' })
				.mockReturnValueOnce({ path: 'attachments/test-image-2.jpg' })
				.mockReturnValueOnce({ path: 'attachments/test-image-3.jpg' })
				.mockReturnValueOnce(null);

			const result = await importService.generateUniqueFilename('test-image', '.jpg', 'attachments');
			expect(result).toBe('test-image-4.jpg');
		});
	});

	describe('Error scenarios', () => {
		it('should handle API service not available', async () => {
			const importServiceWithoutApi = new ImportService(mockApp as any);
			const noteBody = 'Here is an image: ![Test Image](:/abc123def45678901234567890123456)';

			await expect(importServiceWithoutApi.downloadAndStoreImages(noteBody, 'attachments'))
				.rejects.toThrow('Joplin API service is not available for image downloads');
		});

		it('should handle vault creation errors', async () => {
			const noteBody = 'Here is an image: ![Test Image](:/abc123def45678901234567890123456)';
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

			mockJoplinApiService.getResourceMetadata.mockResolvedValue(mockResource);
			mockJoplinApiService.getResourceFile.mockResolvedValue(new ArrayBuffer(1024));
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			mockApp.vault.createBinary.mockRejectedValue(new Error('Vault write error'));

			const result = await importService.downloadAndStoreImages(noteBody, 'attachments');

			expect(result.imageResults).toHaveLength(1);
			expect(result.imageResults[0].success).toBe(false);
			expect(result.imageResults[0].error).toContain('Vault write error');
		});

		it('should handle corrupted image data', async () => {
			const noteBody = 'Here is an image: ![Corrupted](:/abc123def45678901234567890123456)';
			const mockResource: JoplinResource = {
				id: 'abc123def45678901234567890123456',
				title: 'corrupted-image',
				mime: 'image/png',
				filename: 'corrupted.png',
				file_extension: 'png',
				created_time: Date.now(),
				updated_time: Date.now(),
				user_created_time: Date.now(),
				user_updated_time: Date.now(),
				encryption_cipher_text: '',
				encryption_applied: 0,
				encryption_blob_encrypted: 0,
				size: 1024
			};

			mockJoplinApiService.getResourceMetadata.mockResolvedValue(mockResource);
			mockJoplinApiService.getResourceFile.mockResolvedValue(new ArrayBuffer(0)); // Empty/corrupted data

			const result = await importService.downloadAndStoreImages(noteBody, 'attachments');

			expect(result.imageResults).toHaveLength(1);
			expect(result.imageResults[0].success).toBe(false);
		});
	});

	describe('Integration scenarios', () => {
		it('should handle mixed content with images and text', async () => {
			const noteBody = `
				# My Note Title

				This is some text before the image.

				![First Image](:/abc123def45678901234567890123456)

				More text between images.

				![Second Image](:/def456abc78901234567890123456789)

				Final text after images.
			`;

			const mockResource1: JoplinResource = {
				id: 'abc123def45678901234567890123456',
				title: 'first-image',
				mime: 'image/png',
				filename: 'first-image.png',
				file_extension: 'png',
				created_time: Date.now(),
				updated_time: Date.now(),
				user_created_time: Date.now(),
				user_updated_time: Date.now(),
				encryption_cipher_text: '',
				encryption_applied: 0,
				encryption_blob_encrypted: 0,
				size: 1024
			};

			const mockResource2: JoplinResource = {
				id: 'def456abc78901234567890123456789',
				title: 'second-image',
				mime: 'image/jpeg',
				filename: 'second-image.jpg',
				file_extension: 'jpg',
				created_time: Date.now(),
				updated_time: Date.now(),
				user_created_time: Date.now(),
				user_updated_time: Date.now(),
				encryption_cipher_text: '',
				encryption_applied: 0,
				encryption_blob_encrypted: 0,
				size: 2048
			};

			mockJoplinApiService.getResourceMetadata
				.mockResolvedValueOnce(mockResource1)
				.mockResolvedValueOnce(mockResource2);
			mockJoplinApiService.getResourceFile
				.mockResolvedValueOnce(new ArrayBuffer(1024))
				.mockResolvedValueOnce(new ArrayBuffer(2048));
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			const result = await importService.downloadAndStoreImages(noteBody, 'attachments');

			expect(result.imageResults).toHaveLength(2);
			expect(result.imageResults[0].success).toBe(true);
			expect(result.imageResults[1].success).toBe(true);

			// Check that text content is preserved
			expect(result.processedBody).toContain('# My Note Title');
			expect(result.processedBody).toContain('This is some text before the image');
			expect(result.processedBody).toContain('More text between images');
			expect(result.processedBody).toContain('Final text after images');

			// Check that image links are replaced
			expect(result.processedBody).toContain('![First Image](first-image.png)');
			expect(result.processedBody).toContain('![Second Image](second-image.jpg)');
			expect(result.processedBody).not.toContain(':/abc123def45678901234567890123456');
			expect(result.processedBody).not.toContain(':/def456abc78901234567890123456789');
		});
	});
});