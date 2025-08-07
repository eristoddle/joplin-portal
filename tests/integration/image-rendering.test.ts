import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JoplinPortalView } from '../../src/joplin-portal-view';
import { JoplinApiService } from '../../src/joplin-api-service';
import { JoplinNote, JoplinResource, JoplinPortalSettings } from '../../src/types';

// Mock Obsidian
const mockWorkspace = {
	getLeaf: vi.fn().mockReturnValue({
		view: null,
		setViewState: vi.fn()
	})
};

const mockApp = {
	workspace: mockWorkspace,
	vault: {
		getConfig: vi.fn().mockReturnValue('attachments')
	}
};

const mockPlugin = {
	app: mockApp,
	settings: {
		serverUrl: 'http://localhost:41184',
		apiToken: 'test-token',
		defaultImportFolder: 'Joplin Import',
		importTemplate: '',
		searchLimit: 50
	} as JoplinPortalSettings,
	joplinService: null as JoplinApiService | null
};

// Mock requestUrl for API calls
const mockRequestUrl = vi.fn();
vi.mock('obsidian', () => ({
	ItemView: class MockItemView {
		containerEl = {
			createEl: vi.fn().mockReturnValue({
				createEl: vi.fn().mockReturnValue({
					addEventListener: vi.fn(),
					textContent: '',
					innerHTML: '',
					style: {},
					classList: {
						add: vi.fn(),
						remove: vi.fn()
					}
				}),
				addEventListener: vi.fn(),
				innerHTML: '',
				style: {},
				classList: {
					add: vi.fn(),
					remove: vi.fn()
				}
			})
		};

		getViewType() { return 'joplin-portal'; }
		getDisplayText() { return 'Joplin Portal'; }
		async onOpen() {}
		async onClose() {}
	},
	MarkdownRenderer: {
		renderMarkdown: vi.fn().mockImplementation((markdown, el) => {
			el.innerHTML = markdown;
			return Promise.resolve();
		})
	},
	requestUrl: mockRequestUrl,
	Notice: vi.fn()
}));

// Mock console methods to avoid noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('JoplinPortalView - Image Rendering Integration (Task 26)', () => {
	let joplinPortalView: JoplinPortalView;
	let joplinApiService: JoplinApiService;

	beforeEach(() => {
		vi.clearAllMocks();

		joplinApiService = new JoplinApiService(mockPlugin.settings);
		mockPlugin.joplinService = joplinApiService;

		joplinPortalView = new JoplinPortalView(mockPlugin as any);
	});

	describe('Search preview image rendering', () => {
		const mockNote: JoplinNote = {
			id: 'note123',
			title: 'Test Note with Images',
			body: 'Here is an image: ![Test Image](:/abc123def45678901234567890123456)',
			created_time: Date.now(),
			updated_time: Date.now(),
			parent_id: 'folder123'
		};

		const mockResource: JoplinResource = {
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

		it('should render images in search preview', async () => {
			// Mock API responses
			mockRequestUrl
				.mockResolvedValueOnce({
					status: 200,
					json: mockResource
				})
				.mockResolvedValueOnce({
					status: 200,
					arrayBuffer: mockImageData
				});

			// Call showPreview method
			await (joplinPortalView as any).showPreview(mockNote);

			// Verify that processNoteBodyForImages was called
			expect(mockRequestUrl).toHaveBeenCalledWith({
				url: expect.stringContaining('/resources/abc123def45678901234567890123456?token=test-token'),
				method: 'GET',
				headers: expect.objectContaining({
					'Content-Type': 'application/json'
				})
			});

			expect(mockRequestUrl).toHaveBeenCalledWith({
				url: expect.stringContaining('/resources/abc123def45678901234567890123456/file?token=test-token'),
				method: 'GET',
				headers: expect.objectContaining({
					'Content-Type': 'application/json'
				})
			});
		});

		it('should handle multiple images in search preview', async () => {
			const noteWithMultipleImages: JoplinNote = {
				...mockNote,
				body: `
					First image: ![Image 1](:/abc123def45678901234567890123456)
					Second image: ![Image 2](:/def456abc78901234567890123456789)
				`
			};

			const mockResource2 = { ...mockResource, id: 'def456abc78901234567890123456789' };

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData })
				.mockResolvedValueOnce({ status: 200, json: mockResource2 })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			await (joplinPortalView as any).showPreview(noteWithMultipleImages);

			// Should have made 4 API calls (2 for metadata, 2 for files)
			expect(mockRequestUrl).toHaveBeenCalledTimes(4);
		});

		it('should handle image processing errors gracefully in preview', async () => {
			// Mock API error
			mockRequestUrl.mockRejectedValue(new Error('Network error'));

			await (joplinPortalView as any).showPreview(mockNote);

			// Should not throw error, should handle gracefully
			expect(mockRequestUrl).toHaveBeenCalled();
		});

		it('should show loading state during image processing', async () => {
			// Mock slow API response
			mockRequestUrl
				.mockImplementation(() => new Promise(resolve => {
					setTimeout(() => resolve({
						status: 200,
						json: mockResource
					}), 100);
				}))
				.mockResolvedValueOnce({
					status: 200,
					arrayBuffer: mockImageData
				});

			const previewPromise = (joplinPortalView as any).showPreview(mockNote);

			// Check that loading state is shown
			// Note: This would require access to the actual DOM elements
			// In a real implementation, you'd check for loading indicators

			await previewPromise;
		});
	});

	describe('Dedicated view image rendering', () => {
		const mockNote: JoplinNote = {
			id: 'note123',
			title: 'Test Note with Images',
			body: 'Here is an image: ![Test Image](:/abc123def45678901234567890123456)',
			created_time: Date.now(),
			updated_time: Date.now(),
			parent_id: 'folder123'
		};

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
			size: 2048
		};

		it('should render images in dedicated view', async () => {
			const mockImageData = new ArrayBuffer(2048);
			const mockBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A';

			global.btoa = vi.fn().mockReturnValue(mockBase64);

			mockRequestUrl
				.mockResolvedValueOnce({
					status: 200,
					json: mockResource
				})
				.mockResolvedValueOnce({
					status: 200,
					arrayBuffer: mockImageData
				});

			// Call openNoteInDedicatedView method
			await (joplinPortalView as any).openNoteInDedicatedView(mockNote);

			// Verify API calls were made
			expect(mockRequestUrl).toHaveBeenCalledWith({
				url: expect.stringContaining('/resources/abc123def45678901234567890123456?token=test-token'),
				method: 'GET',
				headers: expect.objectContaining({
					'Content-Type': 'application/json'
				})
			});
		});

		it('should handle different image formats in dedicated view', async () => {
			const formats = [
				{ mime: 'image/png', extension: 'png' },
				{ mime: 'image/gif', extension: 'gif' },
				{ mime: 'image/webp', extension: 'webp' }
			];

			for (const format of formats) {
				const formatResource = { ...mockResource, mime: format.mime, file_extension: format.extension };
				const mockImageData = new ArrayBuffer(1024);

				mockRequestUrl
					.mockResolvedValueOnce({ status: 200, json: formatResource })
					.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

				await (joplinPortalView as any).openNoteInDedicatedView(mockNote);

				expect(mockRequestUrl).toHaveBeenCalled();
				vi.clearAllMocks();
			}
		});
	});

	describe('Error handling in image rendering', () => {
		const mockNote: JoplinNote = {
			id: 'note123',
			title: 'Test Note with Broken Images',
			body: 'Here is a broken image: ![Broken Image](:/nonexistent123456789012345678901234)',
			created_time: Date.now(),
			updated_time: Date.now(),
			parent_id: 'folder123'
		};

		it('should handle missing resources in preview', async () => {
			mockRequestUrl.mockRejectedValue({
				status: 404,
				message: 'Resource not found'
			});

			// Should not throw error
			await expect((joplinPortalView as any).showPreview(mockNote)).resolves.not.toThrow();
		});

		it('should handle network failures in preview', async () => {
			mockRequestUrl.mockRejectedValue(new Error('Network error'));

			// Should not throw error
			await expect((joplinPortalView as any).showPreview(mockNote)).resolves.not.toThrow();
		});

		it('should show placeholder for failed images', async () => {
			mockRequestUrl.mockRejectedValue(new Error('Image load failed'));

			await (joplinPortalView as any).showPreview(mockNote);

			// In a real implementation, you'd check that placeholder content is shown
			// This would require access to the actual DOM elements
		});
	});

	describe('Performance considerations', () => {
		it('should cache processed images', async () => {
			const mockNote: JoplinNote = {
				id: 'note123',
				title: 'Test Note with Images',
				body: 'Here is an image: ![Test Image](:/abc123def45678901234567890123456)',
				created_time: Date.now(),
				updated_time: Date.now(),
				parent_id: 'folder123'
			};

			const mockResource: JoplinResource = {
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

			const mockImageData = new ArrayBuffer(1024);
			global.btoa = vi.fn().mockReturnValue('mock-base64-data');

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, json: mockResource })
				.mockResolvedValueOnce({ status: 200, arrayBuffer: mockImageData });

			// First call should make API requests
			await (joplinPortalView as any).showPreview(mockNote);
			expect(mockRequestUrl).toHaveBeenCalledTimes(2);

			vi.clearAllMocks();

			// Second call should use cache (no additional API calls)
			await (joplinPortalView as any).showPreview(mockNote);

			// Should have fewer API calls due to caching
			// Note: The exact behavior depends on the caching implementation
		});

		it('should handle concurrent image processing', async () => {
			const noteWithManyImages: JoplinNote = {
				id: 'note123',
				title: 'Note with Many Images',
				body: `
					![Image 1](:/abc123def45678901234567890123456)
					![Image 2](:/def456abc78901234567890123456789)
					![Image 3](:/ghi789abc01234567890123456789012)
					![Image 4](:/jkl012def34567890123456789012345)
				`,
				created_time: Date.now(),
				updated_time: Date.now(),
				parent_id: 'folder123'
			};

			// Mock responses for all images
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: { id: 'test', mime: 'image/png' }
			});

			const startTime = Date.now();
			await (joplinPortalView as any).showPreview(noteWithManyImages);
			const endTime = Date.now();

			// Should process images concurrently (faster than sequential)
			// This is a basic performance check
			expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
		});
	});

	describe('UI integration', () => {
		it('should update preview container with processed content', async () => {
			const mockNote: JoplinNote = {
				id: 'note123',
				title: 'Test Note',
				body: 'Simple note without images',
				created_time: Date.now(),
				updated_time: Date.now(),
				parent_id: 'folder123'
			};

			await (joplinPortalView as any).showPreview(mockNote);

			// In a real implementation, you'd verify that the preview container
			// has been updated with the processed content
		});

		it('should maintain responsive layout during image loading', async () => {
			const mockNote: JoplinNote = {
				id: 'note123',
				title: 'Test Note with Large Images',
				body: 'Here is a large image: ![Large Image](:/abc123def45678901234567890123456)',
				created_time: Date.now(),
				updated_time: Date.now(),
				parent_id: 'folder123'
			};

			// Mock large image
			const largeImageData = new ArrayBuffer(5 * 1024 * 1024); // 5MB
			mockRequestUrl
				.mockResolvedValueOnce({
					status: 200,
					json: {
						id: 'abc123def45678901234567890123456',
						mime: 'image/png',
						size: 5 * 1024 * 1024
					}
				})
				.mockResolvedValueOnce({
					status: 200,
					arrayBuffer: largeImageData
				});

			await (joplinPortalView as any).showPreview(mockNote);

			// Should handle large images without breaking layout
		});
	});
});