import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportService } from '../../src/import-service';
import { mockJoplinNote, mockJoplinNotes } from '../mocks/joplin-api-mocks';
import { TFile, TFolder } from 'obsidian';
import { Logger } from '../../src/logger';

vi.mock('obsidian');

describe('ImportService', () => {
  let importService: ImportService;
  let mockApp: any;
  let mockVault: any;
  let mockLogger: Logger;

  beforeEach(() => {
    mockVault = {
      create: vi.fn(),
      createFolder: vi.fn(),
      createBinary: vi.fn(),
      modify: vi.fn(),
      getAbstractFileByPath: vi.fn(),
      getRoot: vi.fn().mockReturnValue(new TFolder('')),
      adapter: {
        exists: vi.fn()
      },
      config: {
        attachmentFolderPath: ''
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

  describe('convertJoplinToObsidianMarkdown', () => {
    it('should convert basic Joplin note to Obsidian format', () => {
      const result = importService.convertJoplinToObsidianMarkdown(mockJoplinNote);

      expect(result).toContain('# Test Note');
      expect(result).toContain('This is a test note with some content.');
    });

    it('should handle note without tags', () => {
      const noteWithoutTags = { ...mockJoplinNote, tags: undefined as any };
      const result = importService.convertJoplinToObsidianMarkdown(noteWithoutTags);

      expect(result).toContain('# Test Note');
    });

    it('should handle note without source URL', () => {
      const noteWithoutSource = { ...mockJoplinNote, source_url: undefined as any };
      const result = importService.convertJoplinToObsidianMarkdown(noteWithoutSource);

      expect(result).toContain('# Test Note');
    });

    it('should convert Joplin-specific markdown syntax', () => {
      const noteWithJoplinSyntax = {
        ...mockJoplinNote,
        body: '# Test\n\n[Link](:/resource-id)\n\n![Image](:/image-id)'
      };

      const result = importService.convertJoplinToObsidianMarkdown(noteWithJoplinSyntax);

      // Regular links are preserved as-is (they're not image resources)
      expect(result).toContain('[Link](:/resource-id)');
      // Image resources are converted to placeholder text
      expect(result).toContain('[Joplin Resource: Image (image-id)]');
    });

    it('should preserve existing Obsidian-style links', () => {
      const noteWithObsidianLinks = {
        ...mockJoplinNote,
        body: '# Test\n\n[[Internal Link]]\n\n![[Image.png]]'
      };

      const result = importService.convertJoplinToObsidianMarkdown(noteWithObsidianLinks);

      expect(result).toContain('[[Internal Link]]');
      expect(result).toContain('![[Image.png]]');
    });
  });

  describe('generateFrontmatter', () => {
    it('should generate frontmatter with source URL when available', () => {
      const result = importService.generateFrontmatter(mockJoplinNote);

      expect(result).toContain('---');
      expect(result).toContain(`joplin-id: ${mockJoplinNote.id}`);
      expect(result).toContain(`created: ${new Date(mockJoplinNote.created_time).toISOString()}`);
      expect(result).toContain(`updated: ${new Date(mockJoplinNote.updated_time).toISOString()}`);
      expect(result).toContain(`source: "${mockJoplinNote.source_url}"`);
      expect(result).toMatch(/---\n\n$/);  // Ends with ---\n\n
    });

    it('should generate frontmatter without source URL when not available', () => {
      const noteWithoutSource = { ...mockJoplinNote, source_url: undefined as any };
      const result = importService.generateFrontmatter(noteWithoutSource);

      expect(result).toContain('---');
      expect(result).toContain(`joplin-id: ${noteWithoutSource.id}`);
      expect(result).toContain(`created: ${new Date(noteWithoutSource.created_time).toISOString()}`);
      expect(result).toContain(`updated: ${new Date(noteWithoutSource.updated_time).toISOString()}`);
      expect(result).not.toContain('source:');
      expect(result).toMatch(/---\n\n$/);  // Ends with ---\n\n
    });

    it('should properly escape source URL with quotes', () => {
      const noteWithQuotedUrl = {
        ...mockJoplinNote,
        source_url: 'https://example.com/path?param="value"&other=test'
      };
      const result = importService.generateFrontmatter(noteWithQuotedUrl);

      expect(result).toContain('source: "https://example.com/path?param=\\"value\\"&other=test"');
    });

    it('should handle empty source URL', () => {
      const noteWithEmptySource = { ...mockJoplinNote, source_url: '' };
      const result = importService.generateFrontmatter(noteWithEmptySource);

      expect(result).not.toContain('source:');
    });
  });

  describe('generateFileName', () => {
    it('should generate safe filename from note title', () => {
      const result = importService.generateFileName(mockJoplinNote);
      expect(result).toBe('Test Note.md');
    });

    it('should sanitize special characters in filename', () => {
      const noteWithSpecialChars = {
        ...mockJoplinNote,
        title: 'Test/Note:With*Special?Characters<>|"'
      };

      const result = importService.generateFileName(noteWithSpecialChars);
      expect(result).toBe('Test-Note-With-Special-Characters----.md');
    });

    it('should handle very long titles', () => {
      const noteWithLongTitle = {
        ...mockJoplinNote,
        title: 'A'.repeat(300)
      };

      const result = importService.generateFileName(noteWithLongTitle);
      expect(result.length).toBeLessThanOrEqual(255); // Max filename length
      expect(result).toMatch(/\.md$/);  // Ends with .md
    });

    it('should handle empty title', () => {
      const noteWithEmptyTitle = {
        ...mockJoplinNote,
        title: ''
      };

      const result = importService.generateFileName(noteWithEmptyTitle);
      expect(result).toBe('Untitled Note.md');
    });
  });

  describe.skip('importNote', () => {
    it('should import note to specified folder', async () => {
      const targetFolder = new TFolder('Test Folder');
      mockVault.getAbstractFileByPath.mockReturnValue(targetFolder);
      mockVault.create.mockResolvedValue(new TFile('Test Folder/Test Note.md'));

      const options = {
        targetFolder: 'Test Folder',
        applyTemplate: false,
        conflictResolution: 'rename' as const
      };

      const result = await importService.importNote(mockJoplinNote, options);

      expect(mockVault.create).toHaveBeenCalledWith(
        'Test Folder/Test Note.md',
        expect.stringContaining('# Test Note')
      );
      expect(result.success).toBe(true);
      expect(result.filePath).toBe('Test Folder/Test Note.md');
    });

    it('should create folder if it does not exist', async () => {
      const newFolder = new TFolder('New Folder');
      mockVault.getAbstractFileByPath
        .mockReturnValueOnce(null) // First call for folder check
        .mockReturnValueOnce(newFolder); // Second call after folder creation
      mockVault.createFolder.mockResolvedValue(newFolder);
      mockVault.create.mockResolvedValue(new TFile('New Folder/Test Note.md'));

      const options = {
        targetFolder: 'New Folder',
        applyTemplate: false,
        conflictResolution: 'rename' as const
      };

      await importService.importNote(mockJoplinNote, options);

      expect(mockVault.createFolder).toHaveBeenCalledWith('New Folder');
    });

    it('should handle file conflicts with rename strategy', async () => {
      mockVault.getAbstractFileByPath
        .mockReturnValueOnce(new TFile('Test Folder/Test Note.md'))
        .mockReturnValueOnce(new TFile('Test Folder/Test Note 1.md'))
        .mockReturnValueOnce(null);

      mockVault.create.mockResolvedValue(new TFile('Test Folder/Test Note 2.md'));

      const options = {
        targetFolder: 'Test Folder',
        applyTemplate: false,
        conflictResolution: 'rename' as const
      };

      const result = await importService.importNote(mockJoplinNote, options);

      expect(result.success).toBe(true);
      expect(result.filePath).toBe('Test Folder/Test Note 2.md');
    });

    it('should skip import with skip strategy', async () => {
      const existingFile = new TFile('Test Folder/Test Note.md');
      const targetFolder = new TFolder('Test Folder');
      mockVault.getAbstractFileByPath
        .mockReturnValueOnce(targetFolder) // First call for folder check
        .mockReturnValueOnce(existingFile); // Second call for file conflict check

      const options = {
        targetFolder: 'Test Folder',
        applyTemplate: false,
        conflictResolution: 'skip' as const
      };

      const result = await importService.importNote(mockJoplinNote, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('skipped due to conflict');
      expect(mockVault.create).not.toHaveBeenCalled();
    });

    it('should overwrite with overwrite strategy', async () => {
      const existingFile = new TFile('Test Folder/Test Note.md');
      mockVault.getAbstractFileByPath.mockReturnValue(existingFile);
      mockVault.create.mockResolvedValue(existingFile);

      const options = {
        targetFolder: 'Test Folder',
        applyTemplate: false,
        conflictResolution: 'overwrite' as const
      };

      const result = await importService.importNote(mockJoplinNote, options);

      expect(result.success).toBe(true);
      expect(mockVault.create).toHaveBeenCalled();
    });

    it('should handle import errors gracefully', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      mockVault.create.mockRejectedValue(new Error('Permission denied'));

      const options = {
        targetFolder: 'Test Folder',
        applyTemplate: false,
        conflictResolution: 'rename' as const
      };

      const result = await importService.importNote(mockJoplinNote, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });

  describe.skip('importNotes', () => {
    it('should import multiple notes successfully', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      mockVault.create.mockResolvedValue(new TFile(''));

      const mockOptions = {
        targetFolder: 'Test Folder',
        applyTemplate: false,
        conflictResolution: 'rename' as const
      };

      const results = await importService.importNotes(
        mockJoplinNotes,
        mockOptions
      );

      expect(results.successful).toHaveLength(3);
      expect(results.failed).toHaveLength(0);
    });

    it('should handle mixed success and failure results', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      mockVault.create
        .mockResolvedValueOnce(new TFile('Test Folder/Test Note.md'))
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(new TFile('Test Folder/Note with Special Characters.md'));

      const mockOptions = {
        targetFolder: 'Test Folder',
        applyTemplate: false,
        conflictResolution: 'rename' as const
      };

      const results = await importService.importNotes(
        mockJoplinNotes,
        mockOptions
      );

      expect(results.successful).toHaveLength(2);
      expect(results.failed).toHaveLength(1);
    });

    it('should provide progress callback', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      mockVault.create.mockResolvedValue(new TFile(''));

      const progressCallback = vi.fn();
      const mockOptions = {
        targetFolder: 'Test Folder',
        applyTemplate: false,
        conflictResolution: 'rename' as const
      };

      await importService.importNotes(
        mockJoplinNotes,
        mockOptions,
        progressCallback
      );

      expect(progressCallback).toHaveBeenCalled();
    });
  });
});