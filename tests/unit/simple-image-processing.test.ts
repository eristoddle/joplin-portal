import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JoplinApiService } from '../../src/joplin-api-service';
import { Logger } from '../../src/logger';

describe('Simple Image Processing', () => {
	let joplinApiService: JoplinApiService;
	let mockLogger: Logger;

	beforeEach(() => {
		// Create mock logger
		mockLogger = {
			debug: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			isDebugEnabled: vi.fn().mockReturnValue(false),
			updateSettings: vi.fn()
		} as any;

		const mockSettings = {
			serverUrl: 'http://127.0.0.1:41184',
			apiToken: 'test-token',
			defaultImportFolder: 'Imported from Joplin',
			importTemplate: '',
			searchLimit: 50,
			debugMode: false
		};
		joplinApiService = new JoplinApiService(mockSettings, mockLogger);
	});

	describe('processNoteBodyForPreview', () => {
		it('should convert markdown image links to API URLs', () => {
			const noteBody = 'Here is an image: ![Test Image](:/abc123def45678901234567890123456)';
			const result = joplinApiService.processNoteBodyForPreview(noteBody);

			expect(result).toContain('![Test Image](http://127.0.0.1:41184/resources/abc123def45678901234567890123456/file?token=test-token)');
			expect(result).not.toContain(':/abc123def45678901234567890123456');
		});

		it('should convert HTML image links to API URLs', () => {
			const noteBody = '<p>Here is an HTML image:</p><img width="100" height="50" alt="HTML image" src="joplin-id:abc123def45678901234567890123456"/>';
			const result = joplinApiService.processNoteBodyForPreview(noteBody);

			expect(result).toContain('src="http://127.0.0.1:41184/resources/abc123def45678901234567890123456/file?token=test-token"');
			expect(result).not.toContain('joplin-id:abc123def45678901234567890123456');
			expect(result).toContain('width="100"');
			expect(result).toContain('height="50"');
			expect(result).toContain('alt="HTML image"');
		});

		it('should handle mixed markdown and HTML images', () => {
			const noteBody = `
				<p>Markdown image:</p>
				![Markdown Image](:/abc123def45678901234567890123456)
				<p>HTML image:</p>
				<img alt="HTML Image" src="joplin-id:def456abc78901234567890123456789"/>
			`;
			const result = joplinApiService.processNoteBodyForPreview(noteBody);

			expect(result).toContain('![Markdown Image](http://127.0.0.1:41184/resources/abc123def45678901234567890123456/file?token=test-token)');
			expect(result).toContain('src="http://127.0.0.1:41184/resources/def456abc78901234567890123456789/file?token=test-token"');
			expect(result).not.toContain(':/abc123def45678901234567890123456');
			expect(result).not.toContain('joplin-id:def456abc78901234567890123456789');
		});

		it('should return original body if no images found', () => {
			const noteBody = 'This is a note with no images.';
			const result = joplinApiService.processNoteBodyForPreview(noteBody);

			expect(result).toBe(noteBody);
		});

		it('should handle empty or null body', () => {
			expect(joplinApiService.processNoteBodyForPreview('')).toBe('');
			expect(joplinApiService.processNoteBodyForPreview(null as any)).toBe(null);
		});
	});

	describe('getResourceUrl', () => {
		it('should generate correct resource URL', () => {
			const resourceId = 'abc123def45678901234567890123456';
			const result = joplinApiService.getResourceUrl(resourceId);

			expect(result).toBe('http://127.0.0.1:41184/resources/abc123def45678901234567890123456/file?token=test-token');
		});

		it('should return empty string if no base URL or token', () => {
			const mockSettings = {
				serverUrl: '',
				apiToken: '',
				defaultImportFolder: 'Imported from Joplin',
				importTemplate: '',
				searchLimit: 50
			};
			const service = new JoplinApiService(mockSettings, mockLogger);
			const result = service.getResourceUrl('abc123def45678901234567890123456');

			expect(result).toBe('');
		});
	});
});