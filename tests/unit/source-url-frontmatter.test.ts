import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportService } from '../../src/import-service';
import { JoplinNote } from '../../src/types';
import { Logger } from '../../src/logger';

vi.mock('obsidian');

describe('Source URL Frontmatter Implementation', () => {
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

  describe('Task 34: Add source URL to note frontmatter during import', () => {
    it('should include source URL as "source" field in frontmatter when available', () => {
      const noteWithSourceUrl: JoplinNote = {
        id: 'test-note-1',
        title: 'Test Note with Source',
        body: '# Test Note\n\nThis is a test note.',
        created_time: 1640995200000,
        updated_time: 1640995200000,
        parent_id: 'test-folder-1',
        source_url: 'https://example.com/original-article'
      };

      const frontmatter = importService.generateFrontmatter(noteWithSourceUrl);

      // Verify all required frontmatter fields are present
      expect(frontmatter).toContain('---');
      expect(frontmatter).toContain(`joplin-id: ${noteWithSourceUrl.id}`);
      expect(frontmatter).toContain(`created: ${new Date(noteWithSourceUrl.created_time).toISOString()}`);
      expect(frontmatter).toContain(`updated: ${new Date(noteWithSourceUrl.updated_time).toISOString()}`);

      // Verify source URL is included as "source" field (requirement 3.5)
      expect(frontmatter).toContain(`source: "${noteWithSourceUrl.source_url}"`);

      // Verify proper YAML formatting
      expect(frontmatter).toMatch(/^---\n/);
      expect(frontmatter).toMatch(/---\n\n$/);
    });

    it('should not include source field when source_url is not available', () => {
      const noteWithoutSourceUrl: JoplinNote = {
        id: 'test-note-2',
        title: 'Test Note without Source',
        body: '# Test Note\n\nThis is a test note.',
        created_time: 1640995200000,
        updated_time: 1640995200000,
        parent_id: 'test-folder-1'
        // No source_url field
      };

      const frontmatter = importService.generateFrontmatter(noteWithoutSourceUrl);

      // Verify source field is not included when source_url is undefined
      expect(frontmatter).not.toContain('source:');

      // Verify other fields are still present
      expect(frontmatter).toContain(`joplin-id: ${noteWithoutSourceUrl.id}`);
      expect(frontmatter).toContain(`created: ${new Date(noteWithoutSourceUrl.created_time).toISOString()}`);
      expect(frontmatter).toContain(`updated: ${new Date(noteWithoutSourceUrl.updated_time).toISOString()}`);
    });

    it('should properly escape source URLs with special characters', () => {
      const noteWithSpecialCharsUrl: JoplinNote = {
        id: 'test-note-3',
        title: 'Test Note with Special URL',
        body: '# Test Note\n\nThis is a test note.',
        created_time: 1640995200000,
        updated_time: 1640995200000,
        parent_id: 'test-folder-1',
        source_url: 'https://example.com/path?param="quoted value"&other=test'
      };

      const frontmatter = importService.generateFrontmatter(noteWithSpecialCharsUrl);

      // Verify URL with quotes is properly escaped in YAML
      expect(frontmatter).toContain('source: "https://example.com/path?param=\\"quoted value\\"&other=test"');
    });

    it('should handle empty source_url gracefully', () => {
      const noteWithEmptySourceUrl: JoplinNote = {
        id: 'test-note-4',
        title: 'Test Note with Empty Source',
        body: '# Test Note\n\nThis is a test note.',
        created_time: 1640995200000,
        updated_time: 1640995200000,
        parent_id: 'test-folder-1',
        source_url: ''
      };

      const frontmatter = importService.generateFrontmatter(noteWithEmptySourceUrl);

      // Verify empty source_url is not included
      expect(frontmatter).not.toContain('source:');
    });

    it('should use "source" field name as specified in requirement 3.5', () => {
      const noteWithSourceUrl: JoplinNote = {
        id: 'test-note-5',
        title: 'Test Note for Field Name Verification',
        body: '# Test Note\n\nThis is a test note.',
        created_time: 1640995200000,
        updated_time: 1640995200000,
        parent_id: 'test-folder-1',
        source_url: 'https://example.com/test'
      };

      const frontmatter = importService.generateFrontmatter(noteWithSourceUrl);

      // Verify it uses "source:" not "source-url:" or any other variant
      expect(frontmatter).toContain('source: "https://example.com/test"');
      expect(frontmatter).not.toContain('source-url:');
      expect(frontmatter).not.toContain('source_url:');
      expect(frontmatter).not.toContain('sourceUrl:');
    });
  });
});