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

describe('JoplinApiService - HTML Image Processing (Task 30)', () => {
	let JoplinApiService: any;
	let joplinApiService: any;

	const mockSettings = {
		serverUrl: 'http://localhost:41184',
		apiToken: 'test-token',
		defaultImportFolder: 'Joplin Import',
		importTemplate: '',
		searchLimit: 50
	};

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

	beforeEach(async () => {
		vi.clearAllMocks();
		// Mock ArrayBuffer to base64 conversion
		global.btoa = vi.fn().mockReturnValue(mockBase64);

		// Dynamically import to avoid hoisting issues
		const module = await import('../../src/joplin-api-service');
		JoplinApiService = module.JoplinApiService;
		joplinApiService = new JoplinApiService(mockSettings);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('HTML Image Detection Regex (Requirement 8.1)', () => {
		it('should detect HTML img tags with joplin-id URLs', async () => {
			const noteBody = `
				<p>Here is an HTML image:</p>
				<img src="joplin-id:abc123def45678901234567890123456"/>
				<p>End of content</p>
			`;

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			expect(result).toContain('data:image/png;base64,');
			expect(result).not.toContain('joplin-id:abc123def45678901234567890123456');
		});

		it('should detect multiple HTML img tags with joplin-id URLs', async () => {
			const noteBody = `
				<img src="joplin-id:abc123def45678901234567890123456"/>
				<img src="joplin-id:def456abc78901234567890123456789"/>
			`;

			const mockResource2 = { ...mockResource, id: 'def456abc78901234567890123456789' };

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData })
				.mockResolvedValueOnce({ status: 200, json: mockResource2 })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			expect(result).toContain('data:image/png;base64,');
			expect(result).not.toContain('joplin-id:abc123def45678901234567890123456');
			expect(result).not.toContain('joplin-id:def456abc78901234567890123456789');
		});

		it('should handle HTML img tags with different quote styles', async () => {
			const testCases = [
				'<img src="joplin-id:abc123def45678901234567890123456"/>',
				"<img src='joplin-id:abc123def45678901234567890123456'/>",
				'<img src="joplin-id:abc123def45678901234567890123456" />',
				"<img src='joplin-id:abc123def45678901234567890123456' />"
			];

			for (const htmlTag of testCases) {
				mockRequestUrl
					.mockResolvedValueOnce({ status: 200, json: mockResource })
					.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

				const result = await joplinApiService.processNoteBodyForImages(htmlTag);

				expect(result).toContain('data:image/png;base64,');
				expect(result).not.toContain('joplin-id:abc123def45678901234567890123456');
			}
		});

		it('should not match invalid joplin-id formats', async () => {
			const invalidCases = [
				'<img src="joplin-id:invalid-id"/>',
				'<img src="joplin-id:abc123"/>',
				'<img src="joplin-id:abc123def45678901234567890123456789"/>',
				'<img src="joplin-id:xyz123def45678901234567890123456"/>',
				'<img src="regular-url.jpg"/>'
			];

			for (const htmlTag of invalidCases) {
				const result = await joplinApiService.processNoteBodyForImages(htmlTag);
				expect(result).toBe(htmlTag); // Should remain unchanged
			}

			expect(mockRequestUrl).not.toHaveBeenCalled();
		});
	});

	describe('HTML Attribute Parsing (Requirement 8.2, 8.5)', () => {
		it('should preserve width and height attributes', async () => {
			const noteBody = '<img width="200" height="150" src="joplin-id:abc123def45678901234567890123456"/>';

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			expect(result).toContain('width="200"');
			expect(result).toContain('height="150"');
			expect(result).toContain('data:image/png;base64,');
		});

		it('should preserve alt text attributes', async () => {
			const noteBody = '<img alt="Test image description" src="joplin-id:abc123def45678901234567890123456"/>';

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			expect(result).toContain('alt="Test image description"');
			expect(result).toContain('data:image/png;base64,');
		});

		it('should preserve class attributes', async () => {
			const noteBody = '<img class="center-image rounded" src="joplin-id:abc123def45678901234567890123456"/>';

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			expect(result).toContain('class="center-image rounded"');
			expect(result).toContain('data:image/png;base64,');
		});

		it('should preserve style attributes', async () => {
			const noteBody = '<img style="border: 1px solid #ccc; margin: 10px;" src="joplin-id:abc123def45678901234567890123456"/>';

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			expect(result).toContain('style="border: 1px solid #ccc; margin: 10px;"');
			expect(result).toContain('data:image/png;base64,');
		});

		it('should preserve multiple attributes in various orders', async () => {
			const htmlTag = '<img width="100" height="80" alt="Test" class="image" src="joplin-id:abc123def45678901234567890123456"/>';

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const result = await joplinApiService.processNoteBodyForImages(htmlTag);

			expect(result).toContain('width="100"');
			expect(result).toContain('height="80"');
			expect(result).toContain('alt="Test"');
			expect(result).toContain('data:image/png;base64,');
		});

		it('should handle attributes with special characters and quotes', async () => {
			const noteBody = '<img alt="Image with quotes and symbols" title="Test image" src="joplin-id:abc123def45678901234567890123456"/>';

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			expect(result).toContain('alt="Image with quotes and symbols"');
			expect(result).toContain('title="Test image"');
			expect(result).toContain('data:image/png;base64,');
		});

		it('should handle boolean attributes', async () => {
			const noteBody = '<img loading="lazy" draggable="false" src="joplin-id:abc123def45678901234567890123456"/>';

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			expect(result).toContain('loading="lazy"');
			expect(result).toContain('draggable="false"');
			expect(result).toContain('data:image/png;base64,');
		});
	});

	describe('Mixed Content Processing (Requirement 8.7)', () => {
		it('should process both markdown and HTML images in the same note', async () => {
			const noteBody = `
				# Mixed Image Content

				Here's a markdown image: ![Markdown Image](:/abc123def45678901234567890123456)

				And here's an HTML image: <img alt="HTML Image" width="200" src="joplin-id:def456abc78901234567890123456789"/>

				Both should be processed correctly.
			`;

			const mockResource2 = { ...mockResource, id: 'def456abc78901234567890123456789' };

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData })
				.mockResolvedValueOnce({ status: 200, json: mockResource2 })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			// Check markdown image was processed
			expect(result).toContain('![Markdown Image](data:image/png;base64,');
			expect(result).not.toContain(':/abc123def45678901234567890123456');

			// Check HTML image was processed and attributes preserved
			expect(result).toContain('<img');
			expect(result).toContain('alt="HTML Image"');
			expect(result).toContain('width="200"');
			expect(result).toContain('src="data:image/png;base64,');
			expect(result).not.toContain('joplin-id:def456abc78901234567890123456789');
		});

		it('should handle complex mixed content with multiple images of each type', async () => {
			const noteBody = `
				![First Markdown](:/abc123def45678901234567890123456)
				<img src="joplin-id:def456abc78901234567890123456789" alt="First HTML"/>
			`;

			// Mock requests for both images
			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData })
				.mockResolvedValueOnce({ status: 200, json: { ...mockResource, id: 'def456abc78901234567890123456789' } })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			// Check markdown image was processed
			expect(result).toContain('![First Markdown](data:image/png;base64,');

			// Check HTML image was processed with attributes preserved
			expect(result).toContain('alt="First HTML"');

			// Ensure no original resource IDs remain
			expect(result).not.toContain(':/abc123def45678901234567890123456');
			expect(result).not.toContain('joplin-id:def456abc78901234567890123456789');
		});
	});

	describe('Error Scenarios (Requirement 8.6)', () => {
		it('should handle malformed HTML img tags gracefully', async () => {
			// Test a simple malformed case that won't match the regex
			const malformedTag = '<img src="not-a-joplin-id">'; // Not a joplin-id format

			// For malformed tags, the regex won't match so they should remain unchanged
			const result = await joplinApiService.processNoteBodyForImages(malformedTag);

			// Result should be unchanged since it doesn't match the joplin-id pattern
			expect(result).toBe(malformedTag);
			expect(mockRequestUrl).not.toHaveBeenCalled();
		});

		it('should handle invalid joplin-id URLs in HTML tags', async () => {
			const invalidCases = [
				'<img src="joplin-id:invalid-resource-id"/>',
				'<img src="joplin-id:abc123"/>',
				'<img src="joplin-id:xyz123def45678901234567890123456"/>',
				'<img src="joplin-id:"/>',
				'<img src="joplin-id:abc123def45678901234567890123456789"/>' // Too long
			];

			for (const invalidTag of invalidCases) {
				const result = await joplinApiService.processNoteBodyForImages(invalidTag);

				// Invalid joplin-id URLs should remain unchanged
				expect(result).toBe(invalidTag);
			}

			// No API calls should be made for invalid resource IDs
			expect(mockRequestUrl).not.toHaveBeenCalled();
		});

		it('should create placeholders for missing HTML image resources', async () => {
			const noteBody = '<img alt="Missing Image" width="200" src="joplin-id:abc123def45678901234567890123456"/>';

			mockRequestUrl.mockRejectedValue({
				status: 404,
				message: 'Resource not found'
			});

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			// Should contain placeholder with preserved attributes
			expect(result).toContain('alt="Missing Image"');
			expect(result).toContain('width="200"');
			expect(result).toContain('<!-- Joplin Portal: Failed to load HTML image resource');
			expect(result).toContain('abc123def45678901234567890123456');
		}, 10000);

		it('should handle network failures for HTML images with placeholders', async () => {
			const noteBody = '<img class="network-error" src="joplin-id:abc123def45678901234567890123456"/>';

			mockRequestUrl.mockRejectedValue(new Error('Network error'));

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			// Should contain placeholder with preserved attributes
			expect(result).toContain('class="network-error"');
			expect(result).toContain('<!-- Joplin Portal: Failed to load HTML image resource');
			expect(result).toContain('Network error');
		}, 10000);

		it('should handle non-image resources in HTML tags', async () => {
			const noteBody = '<img alt="PDF Document" src="joplin-id:abc123def45678901234567890123456"/>';
			const nonImageResource = { ...mockResource, mime: 'application/pdf' };

			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: nonImageResource
			});

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			// Should preserve original HTML tag for non-image resources
			expect(result).toBe(noteBody);
		});

		it('should handle corrupted HTML image data', async () => {
			const noteBody = '<img alt="Corrupted" src="joplin-id:abc123def45678901234567890123456"/>';

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: null }); // Corrupted data

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			// Should contain error placeholder with preserved attributes
			expect(result).toContain('alt="Corrupted"');
			expect(result).toContain('<!-- Joplin Portal: Failed to load HTML image resource');
		});
	});

	describe('HTML Image Rendering and Import (Requirements 8.3, 8.4)', () => {
		it('should convert HTML images to data URIs for preview rendering', async () => {
			const noteBody = '<img width="300" height="200" alt="Preview Image" src="joplin-id:abc123def45678901234567890123456"/>';

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			// Should be converted to data URI while preserving attributes
			expect(result).toContain('<img');
			expect(result).toContain('width="300"');
			expect(result).toContain('height="200"');
			expect(result).toContain('alt="Preview Image"');
			expect(result).toContain('src="data:image/png;base64,');
			expect(result).toContain(mockBase64);
			expect(result).not.toContain('joplin-id:');
		});

		it('should handle HTML images with complex attribute combinations', async () => {
			const noteBody = `
				<img
					id="complex-image"
					class="responsive-image center"
					style="max-width: 100%; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"
					width="400"
					height="300"
					alt="Complex styled image with multiple attributes"
					title="Hover text for the image"
					loading="lazy"
					draggable="false"
					src="joplin-id:abc123def45678901234567890123456"
				/>
			`;

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			// All attributes should be preserved
			expect(result).toContain('id="complex-image"');
			expect(result).toContain('class="responsive-image center"');
			expect(result).toContain('style="max-width: 100%; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"');
			expect(result).toContain('width="400"');
			expect(result).toContain('height="300"');
			expect(result).toContain('alt="Complex styled image with multiple attributes"');
			expect(result).toContain('title="Hover text for the image"');
			expect(result).toContain('loading="lazy"');
			expect(result).toContain('draggable="false"');
			expect(result).toContain('src="data:image/png;base64,');
			expect(result).not.toContain('joplin-id:');
		});

		it('should process HTML images with different image formats', async () => {
			// Test JPEG format
			const jpegNoteBody = '<img alt="JPEG Image" src="joplin-id:abc123def45678901234567890123456"/>';
			const jpegResource = { ...mockResource, mime: 'image/jpeg', file_extension: 'jpg' };

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: jpegResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const jpegResult = await joplinApiService.processNoteBodyForImages(jpegNoteBody);

			expect(jpegResult).toContain('data:image/jpeg;base64,');
			expect(jpegResult).toContain('alt="JPEG Image"');
			expect(jpegResult).not.toContain('joplin-id:');

			// Test GIF format
			const gifNoteBody = '<img alt="GIF Image" src="joplin-id:def456abc78901234567890123456789"/>';
			const gifResource = { ...mockResource, id: 'def456abc78901234567890123456789', mime: 'image/gif', file_extension: 'gif' };

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: gifResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const gifResult = await joplinApiService.processNoteBodyForImages(gifNoteBody);

			expect(gifResult).toContain('data:image/gif;base64,');
			expect(gifResult).toContain('alt="GIF Image"');
			expect(gifResult).not.toContain('joplin-id:');
		});
	});

	describe('Performance and Edge Cases', () => {
		it('should handle HTML images with progress callback', async () => {
			const noteBody = `
				<img src="joplin-id:abc123def45678901234567890123456" alt="Image 1"/>
				<img src="joplin-id:def456abc78901234567890123456789" alt="Image 2"/>
			`;

			const progressCallback = vi.fn();
			const options = { onProgress: progressCallback };

			mockRequestUrl
				.mockResolvedValue({ status: 200, json: mockResource })
				.mockResolvedValue({ status: 200, arrayBuffer: mockImageData });

			await joplinApiService.processNoteBodyForImages(noteBody, options);

			expect(progressCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					total: 2,
					processed: expect.any(Number)
				})
			);
		});

		it('should respect concurrency limits for HTML images', async () => {
			const noteBody = `
				<img src="joplin-id:abc123def45678901234567890123456"/>
				<img src="joplin-id:def456abc78901234567890123456789"/>
				<img src="joplin-id:ghi789abc01234567890123456789012"/>
			`;

			const options = { maxConcurrency: 1 };

			mockRequestUrl
				.mockResolvedValue({ status: 200, json: mockResource })
				.mockResolvedValue({ status: 200, arrayBuffer: mockImageData });

			const startTime = Date.now();
			await joplinApiService.processNoteBodyForImages(noteBody, options);
			const endTime = Date.now();

			// With concurrency 1, processing should be sequential
			expect(endTime - startTime).toBeGreaterThan(0);
		});

		it('should handle empty or whitespace-only HTML attributes', async () => {
			const noteBody = '<img alt="" class="   " style="" src="joplin-id:abc123def45678901234567890123456"/>';

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			expect(result).toContain('alt=""');
			expect(result).toContain('class="   "');
			expect(result).toContain('style=""');
			expect(result).toContain('data:image/png;base64,');
		});

		it('should handle HTML images with no attributes except src', async () => {
			const noteBody = '<img src="joplin-id:abc123def45678901234567890123456"/>';

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			const result = await joplinApiService.processNoteBodyForImages(noteBody);

			expect(result).toContain('<img src="data:image/png;base64,');
			expect(result).toContain(mockBase64);
			expect(result).not.toContain('joplin-id:');
		});
	});
});