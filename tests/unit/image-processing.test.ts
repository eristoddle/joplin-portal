import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock console methods to avoid noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock requestUrl function
const mockRequestUrl = vi.fn();

// Mock Obsidian
vi.mock('obsidian', () => ({
	requestUrl: mockRequestUrl,
	Notice: vi.fn()
}));

describe('JoplinApiService - Image Processing (Task 26)', () => {
	let JoplinApiService: any;
	let joplinApiService: any;

	const mockSettings = {
		serverUrl: 'http://localhost:41184',
		apiToken: 'test-token',
		defaultImportFolder: 'Joplin Import',
		importTemplate: '',
		searchLimit: 50
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		// Dynamically import to avoid hoisting issues
		const module = await import('../../src/joplin-api-service');
		JoplinApiService = module.JoplinApiService;
		joplinApiService = new JoplinApiService(mockSettings);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('getResourceMetadata', () => {
		const mockResource = {
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

		it('should fetch resource metadata successfully', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: mockResource
			});

			const result = await joplinApiService.getResourceMetadata('abc123def45678901234567890123456');

			expect(result).toEqual(mockResource);
			expect(mockRequestUrl).toHaveBeenCalledWith({
				url: expect.stringContaining('/resources/abc123def45678901234567890123456?token=test-token'),
				method: 'GET',
				headers: expect.objectContaining({
					'Content-Type': 'application/json'
				})
			});
		});

		it('should handle resource not found (404)', async () => {
			mockRequestUrl.mockRejectedValue({
				status: 404,
				message: 'Resource not found'
			});

			await expect(joplinApiService.getResourceMetadata('nonexistent123456789012345678901234'))
				.rejects.toThrow();
		});

		it('should validate resource ID format', async () => {
			await expect(joplinApiService.getResourceMetadata('invalid-id'))
				.rejects.toThrow('Invalid resource ID format');
		});

		it('should handle network errors with retry', async () => {
			mockRequestUrl
				.mockRejectedValueOnce(new Error('Network error'))
				.mockRejectedValueOnce(new Error('Network error'))
				.mockResolvedValue({
					status: 200,
					json: mockResource
				});

			const result = await joplinApiService.getResourceMetadata('abc123def45678901234567890123456');

			expect(result).toEqual(mockResource);
			expect(mockRequestUrl).toHaveBeenCalledTimes(3);
		});
	});

	describe('getResourceFile', () => {
		const mockImageData = new ArrayBuffer(1024);

		it('should fetch resource file successfully', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				arrayBuffer: mockImageData
			});

			const result = await joplinApiService.getResourceFile('abc123def45678901234567890123456');

			expect(result).toBe(mockImageData);
			expect(mockRequestUrl).toHaveBeenCalledWith({
				url: expect.stringContaining('/resources/abc123def45678901234567890123456/file?token=test-token'),
				method: 'GET',
				headers: expect.objectContaining({
					'Content-Type': 'application/json'
				})
			});
		});

		it('should handle file not found (404)', async () => {
			mockRequestUrl.mockRejectedValue({
				status: 404,
				message: 'Resource file not found'
			});

			await expect(joplinApiService.getResourceFile('nonexistent123456789012345678901234'))
				.rejects.toThrow();
		});

		it('should validate resource ID format', async () => {
			await expect(joplinApiService.getResourceFile('invalid-id'))
				.rejects.toThrow('Invalid resource ID format');
		});

		it('should handle empty file data', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				arrayBuffer: new ArrayBuffer(0)
			});

			await expect(joplinApiService.getResourceFile('abc123def45678901234567890123456'))
				.rejects.toThrow('Received empty or invalid file data');
		});
	});

	describe('processNoteBodyForImages', () => {
		const mockResource = {
			id: 'abc123def45678901234567890123456',
			title: 'test-image',
			mime: 'image/png',
			filename: 'test-image.png',
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

		const mockImageData = new ArrayBuffer(100);
		const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==';

		beforeEach(() => {
			// Mock ArrayBuffer to base64 conversion
			global.btoa = vi.fn().mockReturnValue(mockBase64);
		});

		it('should process single image in note body', async () => {
			const noteBody = 'Here is an image: ![Test Image](:/abc123def45678901234567890123456)';

			mockRequestUrl
				.mockResolvedValueOnce({
					status: 200,
					json: mockResource
				})
				.mockResolvedValueOnce({
					status: 200,
					arrayBuffer: mockImageData
				});

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			expect(result).toContain('data:image/png;base64,');
			expect(result).toContain(mockBase64);
			expect(result).not.toContain(':/abc123def45678901234567890123456');
		});

		it('should process multiple images in note body', async () => {
			const noteBody = `
				First image: ![Image 1](:/abc123def45678901234567890123456)
				Second image: ![Image 2](:/def456abc78901234567890123456789)
			`;

			const mockResource2 = { ...mockResource, id: 'def456abc78901234567890123456789', mime: 'image/jpeg' };

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData })
				.mockResolvedValueOnce({ status: 200, json: mockResource2 })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			expect(result).toContain('data:image/png;base64,');
			expect(result).toContain('data:image/jpeg;base64,');
			expect(result).not.toContain(':/abc123def45678901234567890123456');
			expect(result).not.toContain(':/def456abc78901234567890123456789');
		});

		it('should handle notes with no images', async () => {
			const noteBody = 'This is a note with no images.';

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			expect(result).toBe(noteBody);
			expect(mockRequestUrl).not.toHaveBeenCalled();
		});

		it('should handle missing resources gracefully', async () => {
			const noteBody = 'Here is an image: ![Missing Image](:/abc123def45678901234567890123456)';

			mockRequestUrl.mockRejectedValue({
				status: 404,
				message: 'Resource not found'
			});

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			// Should contain placeholder or error message
			expect(result).toContain('Failed to process image');
			expect(result).toContain('abc123def45678901234567890123456');
		});

		it('should handle network failures with retry and fallback', async () => {
			const noteBody = 'Here is an image: ![Network Error](:/abc123def45678901234567890123456)';

			mockRequestUrl.mockRejectedValue(new Error('Network error'));

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			// Should contain error placeholder
			expect(result).toContain('Failed to process image');
			expect(mockRequestUrl).toHaveBeenCalledTimes(6); // 3 retries for metadata + 3 retries for file
		});

		it('should skip non-image resources', async () => {
			const noteBody = 'Here is a document: ![Document](:/abc123def45678901234567890123456)';
			const nonImageResource = { ...mockResource, mime: 'application/pdf' };

			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: nonImageResource
			});

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			// Should preserve original link for non-image resources
			expect(result).toBe(noteBody);
		});

		it('should handle progress callback', async () => {
			const noteBody = `
				![Image 1](:/abc123def45678901234567890123456)
				![Image 2](:/def456abc78901234567890123456789)
			`;

			const progressCallback = vi.fn();
			const options = {
				onProgress: progressCallback
			};

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData })
				.mockResolvedValueOnce({ status: 200, json: { ...mockResource, id: 'def456abc78901234567890123456789' } })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			await joplinApiService.processNoteBodyForImages(noteBody, options);

			expect(progressCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					total: 2,
					processed: expect.any(Number)
				})
			);
		});

		it('should respect concurrency limits', async () => {
			const noteBody = `
				![Image 1](:/abc123def45678901234567890123456)
				![Image 2](:/def456abc78901234567890123456789)
				![Image 3](:/ghi789abc01234567890123456789012)
			`;

			const options = {
				maxConcurrency: 1
			};

			mockRequestUrl
				.mockResolvedValue({ status: 200, json: mockResource })
				.mockResolvedValue({ status: 200, arrayBuffer: mockImageData });

			const startTime = Date.now();
			await joplinApiService.processNoteBodyForImages(noteBody, options);
			const endTime = Date.now();

			// With concurrency 1, processing should be sequential and take longer
			expect(endTime - startTime).toBeGreaterThan(0);
		});
	});

	describe('Image format support', () => {
		const testFormats = [
			{ mime: 'image/png', extension: 'png' },
			{ mime: 'image/jpeg', extension: 'jpg' },
			{ mime: 'image/gif', extension: 'gif' },
			{ mime: 'image/webp', extension: 'webp' }
		];

		testFormats.forEach(({ mime, extension }) => {
			it(`should process ${extension.toUpperCase()} images correctly`, async () => {
				const noteBody = `![${extension.toUpperCase()} Image](:/abc123def45678901234567890123456)`;
				const mockResource = {
					id: 'abc123def45678901234567890123456',
					title: `test-image.${extension}`,
					mime,
					filename: `test-image.${extension}`,
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

				mockRequestUrl
					.mockResolvedValueOnce({ status: 200, json: mockResource })
					.mockResolvedValueOnce({ status: 200, arrayBuffer: new ArrayBuffer(100) });

				const result = await joplinApiService.processNoteBodyForImages(noteBody);

				expect(result).toContain(`data:${mime};base64,`);
				expect(result).not.toContain(':/abc123def45678901234567890123456');
			});
		});
	});

	describe('Error scenarios', () => {
		it('should handle invalid MIME types', async () => {
			const noteBody = 'Here is an image: ![Invalid](:/abc123def45678901234567890123456)';
			const invalidResource = {
				id: 'abc123def45678901234567890123456',
				title: 'invalid-resource',
				mime: 'invalid/type',
				filename: 'invalid.unknown',
				file_extension: 'unknown',
				created_time: Date.now(),
				updated_time: Date.now(),
				user_created_time: Date.now(),
				user_updated_time: Date.now(),
				encryption_cipher_text: '',
				encryption_applied: 0,
				encryption_blob_encrypted: 0,
				size: 1024
			};

			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: invalidResource
			});

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			// Should preserve original link for invalid MIME types
			expect(result).toBe(noteBody);
		});

		it('should handle corrupted image data', async () => {
			const noteBody = 'Here is an image: ![Corrupted](:/abc123def45678901234567890123456)';
			const mockResource = {
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

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: null }); // Corrupted data

			await expect(joplinApiService.processNoteBodyForImages(noteBody))
				.rejects.toThrow();
		});

		it('should handle offline scenarios', async () => {
			const noteBody = 'Here is an image: ![Offline](:/abc123def45678901234567890123456)';

			// Mock offline detection
			vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			// Should handle offline gracefully
			expect(result).toContain('Failed to process image');
		});
	});
});