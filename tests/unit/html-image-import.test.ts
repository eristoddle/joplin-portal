import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock console methods to avoid noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock Obsidian
const mockVault = {
	create: vi.fn(),
	createBinary: vi.fn(),
	createFolder: vi.fn(),
	getAbstractFileByPath: vi.fn(),
	getConfig: vi.fn().mockReturnValue('attachments')
};

const mockApp = {
	vault: mockVault
};

vi.mock('obsidian', () => ({
	App: vi.fn(),
	TFile: vi.fn(),
	TFolder: vi.fn(),
	normalizePath: (path: string) => path,
	Notice: vi.fn()
}));

// Mock JoplinApiService
const mockJoplinApiService = {
	getResourceMetadata: vi.fn(),
	getResourceFile: vi.fn()
};

describe('ImportService - HTML Image Import (Task 30 Fix)', () => {
	let ImportService: any;
	let importService: any;

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

	beforeEach(async () => {
		vi.clearAllMocks();

		// Dynamically import to avoid hoisting issues
		const module = await import('../../src/import-service');
		ImportService = module.ImportService;
		importService = new ImportService(mockApp as any, mockJoplinApiService as any);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('HTML Image Processing During Import', () => {
		it('should process HTML images with joplin-id URLs during import', async () => {
			const noteWithHtmlImage = {
				id: 'test-note-1',
				title: 'Test Note with HTML Image',
				body: `
					<p>Here is an HTML image:</p>
					<img width="324" height="162" src="joplin-id:abc123def45678901234567890123456"/>
					<p>End of content</p>
				`,
				created_time: Date.now(),
				updated_time: Date.now(),
				parent_id: 'folder1',
				tags: ['test']
			};

			// Mock successful image download
			mockJoplinApiService.getResourceMetadata.mockResolvedValue(mockResource);
			mockJoplinApiService.getResourceFile.mockResolvedValue(mockImageData);
			mockVault.getAbstractFileByPath.mockReturnValue(null); // No existing file
			mockVault.createBinary.mockResolvedValue(undefined);
			mockVault.create.mockResolvedValue({ path: 'Test Folder/Test Note with HTML Image.md' });

			const result = await importService.downloadAndStoreImages(
				noteWithHtmlImage.body,
				'attachments'
			);

			// Check that the HTML image was processed
			expect(result.processedBody).toContain('<img');
			expect(result.processedBody).toContain('width="324"');
			expect(result.processedBody).toContain('height="162"');
			expect(result.processedBody).toContain('src="test-image.png"'); // Should be local filename
			expect(result.processedBody).not.toContain('joplin-id:abc123def45678901234567890123456');

			// Check that image was downloaded
			expect(result.imageResults).toHaveLength(1);
			expect(result.imageResults[0].success).toBe(true);
			expect(result.imageResults[0].resourceId).toBe('abc123def45678901234567890123456');
		});

		it('should preserve HTML attributes during image processing', async () => {
			const noteWithComplexHtmlImage = {
				id: 'test-note-2',
				title: 'Test Note with Complex HTML Image',
				body: `
					<img
						id="complex-image"
						class="responsive-image center"
						style="max-width: 100%; border-radius: 8px;"
						width="400"
						height="300"
						alt="Complex styled image"
						title="Hover text for the image"
						loading="lazy"
						src="joplin-id:abc123def45678901234567890123456"
					/>
				`,
				created_time: Date.now(),
				updated_time: Date.now(),
				parent_id: 'folder1',
				tags: ['test']
			};

			// Mock successful image download
			mockJoplinApiService.getResourceMetadata.mockResolvedValue(mockResource);
			mockJoplinApiService.getResourceFile.mockResolvedValue(mockImageData);
			mockVault.getAbstractFileByPath.mockReturnValue(null);
			mockVault.createBinary.mockResolvedValue(undefined);

			const result = await importService.downloadAndStoreImages(
				noteWithComplexHtmlImage.body,
				'attachments'
			);

			// Check that all attributes are preserved
			expect(result.processedBody).toContain('id="complex-image"');
			expect(result.processedBody).toContain('class="responsive-image center"');
			expect(result.processedBody).toContain('style="max-width: 100%; border-radius: 8px;"');
			expect(result.processedBody).toContain('width="400"');
			expect(result.processedBody).toContain('height="300"');
			expect(result.processedBody).toContain('alt="Complex styled image"');
			expect(result.processedBody).toContain('title="Hover text for the image"');
			expect(result.processedBody).toContain('loading="lazy"');
			expect(result.processedBody).toContain('src="test-image.png"');
			expect(result.processedBody).not.toContain('joplin-id:');
		});

		it('should handle mixed markdown and HTML images', async () => {
			const noteWithMixedImages = {
				id: 'test-note-3',
				title: 'Test Note with Mixed Images',
				body: `
					# Mixed Image Content

					Here's a markdown image: ![Markdown Image](:/abc123def45678901234567890123456)

					And here's an HTML image: <img alt="HTML Image" width="200" src="joplin-id:def456abc78901234567890123456789"/>

					Both should be processed correctly.
				`,
				created_time: Date.now(),
				updated_time: Date.now(),
				parent_id: 'folder1',
				tags: ['test']
			};

			const mockResource2 = { ...mockResource, id: 'def456abc78901234567890123456789' };

			// Mock successful image downloads for both images
			mockJoplinApiService.getResourceMetadata
				.mockResolvedValueOnce(mockResource)
				.mockResolvedValueOnce(mockResource2);
			mockJoplinApiService.getResourceFile
				.mockResolvedValueOnce(mockImageData)
				.mockResolvedValueOnce(mockImageData);
			mockVault.getAbstractFileByPath.mockReturnValue(null);
			mockVault.createBinary.mockResolvedValue(undefined);

			const result = await importService.downloadAndStoreImages(
				noteWithMixedImages.body,
				'attachments'
			);

			// Check markdown image was processed
			expect(result.processedBody).toContain('![Markdown Image](test-image.png)');
			expect(result.processedBody).not.toContain(':/abc123def45678901234567890123456');

			// Check HTML image was processed with attributes preserved
			expect(result.processedBody).toContain('<img');
			expect(result.processedBody).toContain('alt="HTML Image"');
			expect(result.processedBody).toContain('width="200"');
			expect(result.processedBody).toContain('src="test-image.png"');
			expect(result.processedBody).not.toContain('joplin-id:def456abc78901234567890123456789');

			// Check that both images were downloaded
			expect(result.imageResults).toHaveLength(2);
			expect(result.imageResults.every(img => img.success)).toBe(true);
		});

		it('should create error placeholders for failed HTML images', async () => {
			const noteWithFailedHtmlImage = {
				id: 'test-note-4',
				title: 'Test Note with Failed HTML Image',
				body: '<img alt="Failed Image" width="200" src="joplin-id:abc123def45678901234567890123456"/>',
				created_time: Date.now(),
				updated_time: Date.now(),
				parent_id: 'folder1',
				tags: ['test']
			};

			// Mock failed image download
			mockJoplinApiService.getResourceMetadata.mockRejectedValue(new Error('Resource not found'));

			const result = await importService.downloadAndStoreImages(
				noteWithFailedHtmlImage.body,
				'attachments'
			);

			// Check that error placeholder was created with preserved attributes
			expect(result.processedBody).toContain('<!-- Warning: Failed to download HTML image');
			expect(result.processedBody).toContain('alt="Failed Image"');
			expect(result.processedBody).toContain('width="200"');
			expect(result.processedBody).toContain('title="Failed to download image resource');
			expect(result.processedBody).toContain('data:image/svg+xml;base64,'); // Broken image placeholder

			// Check that image result shows failure
			expect(result.imageResults).toHaveLength(1);
			expect(result.imageResults[0].success).toBe(false);
			expect(result.imageResults[0].error).toContain('Resource not found');
		});

		it('should handle HTML images with no attributes except src', async () => {
			const noteWithSimpleHtmlImage = {
				id: 'test-note-5',
				title: 'Test Note with Simple HTML Image',
				body: '<img src="joplin-id:abc123def45678901234567890123456"/>',
				created_time: Date.now(),
				updated_time: Date.now(),
				parent_id: 'folder1',
				tags: ['test']
			};

			// Mock successful image download
			mockJoplinApiService.getResourceMetadata.mockResolvedValue(mockResource);
			mockJoplinApiService.getResourceFile.mockResolvedValue(mockImageData);
			mockVault.getAbstractFileByPath.mockReturnValue(null);
			mockVault.createBinary.mockResolvedValue(undefined);

			const result = await importService.downloadAndStoreImages(
				noteWithSimpleHtmlImage.body,
				'attachments'
			);

			// Check that simple HTML image was processed
			expect(result.processedBody).toContain('<img src="test-image.png"/>');
			expect(result.processedBody).not.toContain('joplin-id:');

			// Check that image was downloaded
			expect(result.imageResults).toHaveLength(1);
			expect(result.imageResults[0].success).toBe(true);
		});
	});
});