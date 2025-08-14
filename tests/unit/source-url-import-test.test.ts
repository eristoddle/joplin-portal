import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportService } from '../../src/import-service';
import { JoplinNote } from '../../src/types';
import { Logger } from '../../src/logger';

vi.mock('obsidian');

describe('Source URL Import Test', () => {
  let importService: ImportService;
  let mockApp: any;
  let mockLogger: Logger;

  beforeEach(() => {
    const mockVault = {
      create: vi.fn(),
      createFolder: vi.fn(),
      getAbstractFileByPath: vi.fn(),
      getRoot: vi.fn().mockReturnValue({ path: '' }),
      adapter: {
        exists: vi.fn()
      }
    };

    mockApp = {
      vault: mockVault
    };

    // Create mock logger
    mockLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      isDebugEnabled: vi.fn().mockReturnValue(false),
      updateSettings: vi.fn()
    } as any;

    importService = new ImportService(mockApp, mockLogger);
    vi.clearAllMocks();
  });

  describe('Source URL in frontmatter during import', () => {
    it('should include source URL in frontmatter when present', () => {
      const noteWithSource: JoplinNote = {
        id: 'test-note-1',
        title: 'Test Note with Source',
        body: '# Test Note\n\nThis is a test note with a source URL.',
        created_time: 1640995200000,
        updated_time: 1640995200000,
        parent_id: 'test-folder-1',
        source_url: 'https://example.com/original-article'
      };

      const frontmatter = importService.generateFrontmatter(noteWithSource);

      console.log('Generated frontmatter:', frontmatter);

      // Verify the frontmatter contains the source URL
      expect(frontmatter).toContain('source: "https://example.com/original-article"');
      expect(frontmatter).toContain('joplin-id: test-note-1');
      expect(frontmatter).toContain('created:');
      expect(frontmatter).toContain('updated:');
      expect(frontmatter).toMatch(/^---\n/);
      expect(frontmatter).toMatch(/---\n\n$/);
    });

    it('should not include source field when source_url is undefined', () => {
      const noteWithoutSource: JoplinNote = {
        id: 'test-note-2',
        title: 'Test Note without Source',
        body: '# Test Note\n\nThis is a test note without a source URL.',
        created_time: 1640995200000,
        updated_time: 1640995200000,
        parent_id: 'test-folder-1'
        // No source_url field
      };

      const frontmatter = importService.generateFrontmatter(noteWithoutSource);

      console.log('Generated frontmatter (no source):', frontmatter);

      // Verify the frontmatter does not contain source field
      expect(frontmatter).not.toContain('source:');
      expect(frontmatter).toContain('joplin-id: test-note-2');
    });

    it('should not include source field when source_url is empty string', () => {
      const noteWithEmptySource: JoplinNote = {
        id: 'test-note-3',
        title: 'Test Note with Empty Source',
        body: '# Test Note\n\nThis is a test note with empty source URL.',
        created_time: 1640995200000,
        updated_time: 1640995200000,
        parent_id: 'test-folder-1',
        source_url: ''
      };

      const frontmatter = importService.generateFrontmatter(noteWithEmptySource);

      console.log('Generated frontmatter (empty source):', frontmatter);

      // Verify the frontmatter does not contain source field for empty string
      expect(frontmatter).not.toContain('source:');
      expect(frontmatter).toContain('joplin-id: test-note-3');
    });

    it('should properly escape URLs with special characters', () => {
      const noteWithSpecialUrl: JoplinNote = {
        id: 'test-note-4',
        title: 'Test Note with Special URL',
        body: '# Test Note\n\nThis is a test note with special characters in URL.',
        created_time: 1640995200000,
        updated_time: 1640995200000,
        parent_id: 'test-folder-1',
        source_url: 'https://example.com/path?param="quoted value"&other=test'
      };

      const frontmatter = importService.generateFrontmatter(noteWithSpecialUrl);

      console.log('Generated frontmatter (special chars):', frontmatter);

      // Verify the URL is properly escaped
      expect(frontmatter).toContain('source: "https://example.com/path?param=\\"quoted value\\"&other=test"');
    });

    it('should handle URLs with various protocols', () => {
      const testCases = [
        'https://example.com/article',
        'http://example.com/article',
        'ftp://files.example.com/document.pdf',
        'file:///local/path/document.txt'
      ];

      testCases.forEach((url, index) => {
        const note: JoplinNote = {
          id: `test-note-${index + 5}`,
          title: `Test Note ${index + 5}`,
          body: '# Test Note\n\nThis is a test note.',
          created_time: 1640995200000,
          updated_time: 1640995200000,
          parent_id: 'test-folder-1',
          source_url: url
        };

        const frontmatter = importService.generateFrontmatter(note);

        console.log(`Generated frontmatter for ${url}:`, frontmatter);

        expect(frontmatter).toContain(`source: "${url}"`);
      });
    });
  });
});