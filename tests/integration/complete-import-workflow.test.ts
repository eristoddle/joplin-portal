import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportService } from '../../src/import-service';
import { JoplinNote, JoplinResource, ImportOptions, ImageImportResult } from '../../src/types';

// Mock Obsidian
const mockApp = {
	vault: {
		getConfig: vi.fn().mockReturnValue('attachments'),
		getAbstractFileByPath: vi.fn().mockReturnValue(null),
		createFolder: vi.fn().mockResolvedValue({ path: 'attachments' }),
		createBinary: vi.fn().mockResolvedValue({ path: 'attachments/test-image.jpg' }),
		create: vi.fn().mockResolvedValue({ path: 'Joplin Import/test-note.md' }),
		modify: vi.fn().mockResolvedValue(undefined)
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

describe('Complete Import Workflow with Images (Task 26)', () => {
	let importService: ImportService;

	beforeEach(() => {
		vi.clearAllMocks();
		importService = new ImportService(mockApp as any, mockJoplinApiService as any);
	});

	describe('End-to-end import workflow', () => {
		const mockNote: JoplinNote = {
			id: 'note123',
			title: 'Test Note with Images',
			body: `# My Test Note

This is a note with multiple images and content.

![First Image](:/abc123def45678901234567890123456)

Some text between images.

![Second Image](:/def456abc78901234567890123456789)

Final paragraph with more content.`,
			created_time: Date.now() - 86400000, // 1 day ago
			updated_time: Date.now() - 3600000,  // 1 hour ago
			parent_id: 'folder123'
		};

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

		const mockImageData1 = new ArrayBuffer(1024);
		const mockImageData2 = new ArrayBuffer(2048);

		it('should complete full import workflow with image download and storage', async () => {
			const importOptions: ImportOptions = {
				targetFolder: 'Joplin Import',
				applyTemplate: false,
				conflictResolution: 'rename'
			};

			// Mock API responses for images
			mockJoplinApiService.getResourceMetadata
				.mockResolvedValueOnce(mockResource1)
				.mockResolvedValueOnce(mockResource2);
			mockJoplinApiService.getResourceFile
				.mockResolvedValueOnce(mockImageData1)
				.mockResolvedValueOnce(mockImageData2);

			// Mock vault operations
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			const result = await importService.importNoteWithOptions(mockNote, importOptions);

			// Verify image downloads
			expect(mockJoplinApiService.getResourceMetadata).toHaveBeenCalledTimes(2);
			expect(mockJoplinApiService.getResourceFile).toHaveBeenCalledTimes(2);

			// Verify image files were created
			expect(mockApp.vault.createBinary).toHaveBeenCalledWith(
				'attachments/first-image.png',
				expect.any(Uint8Array)
			);
			expect(mockApp.vault.createBinary).toHaveBeenCalledWith(
				'attachments/second-image.jpg',
				expect.any(Uint8Array)
			);

			// Verify note was created with processed content
			expect(mockApp.vault.create).toHaveBeenCalledWith(
				'Joplin Import/Test Note with Images.md',
				expect.stringContaining('![First Image](first-image.png)')
			);
			expect(mockApp.vault.create).toHaveBeenCalledWith(
				'Joplin Import/Test Note with Images.md',
				expect.stringContaining('![Second Image](second-image.jpg)')
			);

			// Verify frontmatter was added
			const createdContent = mockApp.vault.create.mock.calls[0][1];
			expect(createdContent).toContain('---');
			expect(createdContent).toContain(`joplin-id: ${mockNote.id}`);
			expect(createdContent).toContain('created:');
			expect(createdContent).toContain('updated:');

			// Verify result structure
			expect(result.action).toBe('created');
			expect(result.originalFilename).toBe('Test Note with Images');
			expect(result.finalFilename).toBe('Test Note with Images');
			expect(result.imageResults).toHaveLength(2);
			expect(result.imageResults?.[0].success).toBe(true);
			expect(result.imageResults?.[1].success).toBe(true);
		});

		it('should handle mixed success/failure in image downloads during import', async () => {
			const importOptions: ImportOptions = {
				targetFolder: 'Joplin Import',
				applyTemplate: false,
				conflictResolution: 'rename'
			};

			// Mock first image success, second image failure
			mockJoplinApiService.getResourceMetadata
				.mockResolvedValueOnce(mockResource1)
				.mockRejectedValueOnce(new Error('Network error'));
			mockJoplinApiService.getResourceFile
				.mockResolvedValueOnce(mockImageData1);

			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			const result = await importService.importNoteWithOptions(mockNote, importOptions);

			// Should still complete import
			expect(result.action).toBe('created');
			expect(result.imageResults).toHaveLength(2);
			expect(result.imageResults?.[0].success).toBe(true);
			expect(result.imageResults?.[1].success).toBe(false);

			// Check that note content has warning for failed image
			const createdContent = mockApp.vault.create.mock.calls[0][1];
			expect(createdContent).toContain('![First Image](first-image.png)');
			expect(createdContent).toContain('<!-- Warning: Failed to download image');
			expect(createdContent).toContain('def456abc78901234567890123456789');
		});

		it('should handle import with no images', async () => {
			const noteWithoutImages: JoplinNote = {
				...mockNote,
				body: '# Simple Note\n\nThis note has no images, just text content.'
			};

			const importOptions: ImportOptions = {
				targetFolder: 'Joplin Import',
				applyTemplate: false,
				conflictResolution: 'rename'
			};

			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			const result = await importService.importNoteWithOptions(noteWithoutImages, importOptions);

			// Should not call image-related APIs
			expect(mockJoplinApiService.getResourceMetadata).not.toHaveBeenCalled();
			expect(mockJoplinApiService.getResourceFile).not.toHaveBeenCalled();
			expect(mockApp.vault.createBinary).not.toHaveBeenCalled();

			// Should still create note
			expect(mockApp.vault.create).toHaveBeenCalled();
			expect(result.action).toBe('created');
			expect(result.imageResults).toHaveLength(0);
		});

		it('should handle filename conflicts during import', async () => {
			const importOptions: ImportOptions = {
				targetFolder: 'Joplin Import',
				applyTemplate: false,
				conflictResolution: 'rename'
			};

			// Mock image processing
			mockJoplinApiService.getResourceMetadata
				.mockResolvedValueOnce(mockResource1)
				.mockResolvedValueOnce(mockResource2);
			mockJoplinApiService.getResourceFile
				.mockResolvedValueOnce(mockImageData1)
				.mockResolvedValueOnce(mockImageData2);

			// Mock note file conflict
			mockApp.vault.getAbstractFileByPath
				.mockReturnValueOnce(null) // No conflict for images
				.mockReturnValueOnce(null)
				.mockReturnValueOnce({ path: 'Joplin Import/Test Note with Images.md' }) // Note conflict
				.mockReturnValueOnce(null); // No conflict for renamed note

			const result = await importService.importNoteWithOptions(mockNote, importOptions);

			expect(result.action).toBe('renamed');
			expect(result.finalFilename).toBe('Test Note with Images 1');
			expect(mockApp.vault.create).toHaveBeenCalledWith(
				'Joplin Import/Test Note with Images 1.md',
				expect.any(String)
			);
		});

		it('should handle overwrite conflict resolution', async () => {
			const importOptions: ImportOptions = {
				targetFolder: 'Joplin Import',
				applyTemplate: false,
				conflictResolution: 'overwrite'
			};

			const existingFile = { path: 'Joplin Import/Test Note with Images.md' };

			// Mock image processing
			mockJoplinApiService.getResourceMetadata
				.mockResolvedValueOnce(mockResource1)
				.mockResolvedValueOnce(mockResource2);
			mockJoplinApiService.getResourceFile
				.mockResolvedValueOnce(mockImageData1)
				.mockResolvedValueOnce(mockImageData2);

			// Mock file conflict
			mockApp.vault.getAbstractFileByPath
				.mockReturnValueOnce(null) // No conflict for images
				.mockReturnValueOnce(null)
				.mockReturnValueOnce(existingFile); // Note conflict

			const result = await importService.importNoteWithOptions(mockNote, importOptions);

			expect(result.action).toBe('overwritten');
			expect(mockApp.vault.modify).toHaveBeenCalledWith(
				existingFile,
				expect.stringContaining('![First Image](first-image.png)')
			);
		});
	});

	describe('Batch import with images', () => {
		const mockNotes: JoplinNote[] = [
			{
				id: 'note1',
				title: 'First Note',
				body: 'First note with image: ![Image 1](:/abc123def45678901234567890123456)',
				created_time: Date.now(),
				updated_time: Date.now(),
				parent_id: 'folder1'
			},
			{
				id: 'note2',
				title: 'Second Note',
				body: 'Second note with image: ![Image 2](:/def456abc78901234567890123456789)',
				created_time: Date.now(),
				updated_time: Date.now(),
				parent_id: 'folder1'
			},
			{
				id: 'note3',
				title: 'Third Note',
				body: 'Third note without images',
				created_time: Date.now(),
				updated_time: Date.now(),
				parent_id: 'folder1'
			}
		];

		it('should import multiple notes with images', async () => {
			const importOptions: ImportOptions = {
				targetFolder: 'Joplin Import',
				applyTemplate: false,
				conflictResolution: 'rename'
			};

			// Mock image resources
			const mockResource1: JoplinResource = {
				id: 'abc123def45678901234567890123456',
				title: 'image-1',
				mime: 'image/png',
				filename: 'image-1.png',
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
				title: 'image-2',
				mime: 'image/jpeg',
				filename: 'image-2.jpg',
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

			const result = await importService.importNotes(mockNotes, importOptions);

			expect(result.successful).toHaveLength(3);
			expect(result.failed).toHaveLength(0);

			// Verify images were processed for first two notes
			expect(mockJoplinApiService.getResourceMetadata).toHaveBeenCalledTimes(2);
			expect(mockJoplinApiService.getResourceFile).toHaveBeenCalledTimes(2);
			expect(mockApp.vault.createBinary).toHaveBeenCalledTimes(2);

			// Verify all notes were created
			expect(mockApp.vault.create).toHaveBeenCalledTimes(3);

			// Check image results
			expect(result.successful[0].imageResults).toHaveLength(1);
			expect(result.successful[1].imageResults).toHaveLength(1);
			expect(result.successful[2].imageResults).toHaveLength(0); // No images in third note
		});

		it('should handle progress tracking during batch import', async () => {
			const importOptions: ImportOptions = {
				targetFolder: 'Joplin Import',
				applyTemplate: false,
				conflictResolution: 'rename'
			};

			const progressCallback = vi.fn();

			// Mock simple responses (no images for simplicity)
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			await importService.importNotes(mockNotes, importOptions, progressCallback);

			// Verify progress callback was called for each note
			expect(progressCallback).toHaveBeenCalledTimes(mockNotes.length);

			// Check progress structure
			expect(progressCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					noteIndex: expect.any(Number),
					totalNotes: mockNotes.length,
					currentNote: expect.any(String),
					stage: expect.any(String)
				})
			);
		});

		it('should continue batch import even if some notes fail', async () => {
			const importOptions: ImportOptions = {
				targetFolder: 'Joplin Import',
				applyTemplate: false,
				conflictResolution: 'rename'
			};

			// Mock first note success, second note failure, third note success
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			mockApp.vault.create
				.mockResolvedValueOnce({ path: 'Joplin Import/First Note.md' })
				.mockRejectedValueOnce(new Error('Vault error'))
				.mockResolvedValueOnce({ path: 'Joplin Import/Third Note.md' });

			const result = await importService.importNotes(mockNotes, importOptions);

			expect(result.successful).toHaveLength(2);
			expect(result.failed).toHaveLength(1);
			expect(result.failed[0].note.id).toBe('note2');
			expect(result.failed[0].error).toContain('Vault error');
		});
	});

	describe('Performance and reliability', () => {
		it('should handle large images during import', async () => {
			const noteWithLargeImage: JoplinNote = {
				id: 'note-large',
				title: 'Note with Large Image',
				body: 'Large image: ![Large Image](:/abc123def45678901234567890123456)',
				created_time: Date.now(),
				updated_time: Date.now(),
				parent_id: 'folder1'
			};

			const largeImageResource: JoplinResource = {
				id: 'abc123def45678901234567890123456',
				title: 'large-image',
				mime: 'image/png',
				filename: 'large-image.png',
				file_extension: 'png',
				created_time: Date.now(),
				updated_time: Date.now(),
				user_created_time: Date.now(),
				user_updated_time: Date.now(),
				encryption_cipher_text: '',
				encryption_applied: 0,
				encryption_blob_encrypted: 0,
				size: 10 * 1024 * 1024 // 10MB
			};

			const largeImageData = new ArrayBuffer(10 * 1024 * 1024);

			mockJoplinApiService.getResourceMetadata.mockResolvedValue(largeImageResource);
			mockJoplinApiService.getResourceFile.mockResolvedValue(largeImageData);
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			const importOptions: ImportOptions = {
				targetFolder: 'Joplin Import',
				applyTemplate: false,
				conflictResolution: 'rename'
			};

			const result = await importService.importNoteWithOptions(noteWithLargeImage, importOptions);

			expect(result.action).toBe('created');
			expect(result.imageResults).toHaveLength(1);
			expect(result.imageResults?.[0].success).toBe(true);

			// Verify large image was handled
			expect(mockApp.vault.createBinary).toHaveBeenCalledWith(
				'attachments/large-image.png',
				expect.any(Uint8Array)
			);
		});

		it('should handle concurrent image downloads efficiently', async () => {
			const noteWithManyImages: JoplinNote = {
				id: 'note-many-images',
				title: 'Note with Many Images',
				body: `
					![Image 1](:/abc123def45678901234567890123456)
					![Image 2](:/def456abc78901234567890123456789)
					![Image 3](:/ghi789abc01234567890123456789012)
					![Image 4](:/jkl012def34567890123456789012345)
					![Image 5](:/mno345ghi56789012345678901234567)
				`,
				created_time: Date.now(),
				updated_time: Date.now(),
				parent_id: 'folder1'
			};

			// Mock responses for all images
			const mockResource = {
				id: 'test',
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

			mockJoplinApiService.getResourceMetadata.mockResolvedValue(mockResource);
			mockJoplinApiService.getResourceFile.mockResolvedValue(new ArrayBuffer(1024));
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			const importOptions: ImportOptions = {
				targetFolder: 'Joplin Import',
				applyTemplate: false,
				conflictResolution: 'rename'
			};

			const startTime = Date.now();
			const result = await importService.importNoteWithOptions(noteWithManyImages, importOptions);
			const endTime = Date.now();

			expect(result.action).toBe('created');
			expect(result.imageResults).toHaveLength(5);

			// Should complete within reasonable time (concurrent processing)
			expect(endTime - startTime).toBeLessThan(10000); // 10 seconds max

			// All images should be processed successfully
			result.imageResults?.forEach(imageResult => {
				expect(imageResult.success).toBe(true);
			});
		});
	});
});