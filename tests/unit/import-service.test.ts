import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportService } from '../../src/import-service';
import { mockJoplinNote, mockJoplinNotes } from '../mocks/joplin-api-mocks';
import { TFile, TFolder } from 'obsidian';

vi.mock('obsidian');

describe('ImportService', () => {
  let importService: ImportService;
  let mockApp: any;
  let mockVault: any;

  beforeEach(() => {
    mockVault = {
      create: vi.fn(),
      createFolder: vi.fn(),
      getAbstractFileByPath: vi.fn(),
      adapter: {
        exists: vi.fn()
      }
    };

    mockApp = {
      vault: mockVault
    };

    importService = new ImportService(mockApp);
    vi.clearAllMocks();
  });

  describe('convertJoplinToObsidian', () => {
    it('should convert basic Joplin note to Obsidian format', () => {
      const result = importService.convertJoplinToObsidian(mockJoplinNote);

      expect(result).toContain('# Test Note');
      expect(result).toContain('This is a test note with some content.');
      expect(result).toContain('Created: 2022-01-01');
      expect(result).toContain('Tags: #test #sample');
      expect(result).toContain('Source: https://example.com');
    });

    it('should handle note without tags', () => {
      const noteWithoutTags = { ...mockJoplinNote, tags: undefined };
      const result = importService.convertJoplinToObsidian(noteWithoutTags);

      expect(result).not.toContain('Tags:');
      expect(result).toContain('# Test Note');
    });

    it('should handle note without source URL', () => {
      const noteWithoutSource = { ...mockJoplinNote, source_url: undefined };
      const result = importService.convertJoplinToObsidian(noteWithoutSource);

      expect(result).not.toContain('Source:');
      expect(result).toContain('# Test Note');
    });

    it('should convert Joplin-specific markdown syntax', () => {
      const noteWithJoplinSyntax = {
        ...mockJoplinNote,
        body: '# Test\n\n[Link](:/resource-id)\n\n![Image](:/image-id)'
      };

      const result = importService.convertJoplinToObsidian(noteWithJoplinSyntax);

      expect(result).toContain('[Link](resource-id)');
      expect(result).toContain('![Image](image-id)');
    });

    it('should preserve existing Obsidian-style links', () => {
      const noteWithObsidianLinks = {
        ...mockJoplinNote,
        body: '# Test\n\n[[Internal Link]]\n\n![[Image.png]]'
      };

      const result = importService.convertJoplinToObsidian(noteWithObsidianLinks);

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
      const noteWithoutSource = { ...mockJoplinNote, source_url: undefined };
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

  describe('importNote', () => {
    it('should import note to specified folder', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      mockVault.create.mockResolvedValue(new TFile('Test Folder/Test Note.md'));

      const result = await importService.importNote(mockJoplinNote, 'Test Folder');

      expect(mockVault.create).toHaveBeenCalledWith(
        'Test Folder/Test Note.md',
        expect.stringContaining('# Test Note')
      );
      expect(result.success).toBe(true);
      expect(result.filePath).toBe('Test Folder/Test Note.md');
    });

    it('should create folder if it does not exist', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      mockVault.createFolder.mockResolvedValue(new TFolder('New Folder'));
      mockVault.create.mockResolvedValue(new TFile('New Folder/Test Note.md'));

      await importService.importNote(mockJoplinNote, 'New Folder');

      expect(mockVault.createFolder).toHaveBeenCalledWith('New Folder');
    });

    it('should handle file conflicts with rename strategy', async () => {
      mockVault.getAbstractFileByPath
        .mockReturnValueOnce(new TFile('Test Folder/Test Note.md'))
        .mockReturnValueOnce(new TFile('Test Folder/Test Note 1.md'))
        .mockReturnValueOnce(null);

      mockVault.create.mockResolvedValue(new TFile('Test Folder/Test Note 2.md'));

      const result = await importService.importNote(
        mockJoplinNote,
        'Test Folder',
        { conflictResolution: 'rename' }
      );

      expect(result.success).toBe(true);
      expect(result.filePath).toBe('Test Folder/Test Note 2.md');
    });

    it('should skip import with skip strategy', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(new TFile('Test Folder/Test Note.md'));

      const result = await importService.importNote(
        mockJoplinNote,
        'Test Folder',
        { conflictResolution: 'skip' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
      expect(mockVault.create).not.toHaveBeenCalled();
    });

    it('should overwrite with overwrite strategy', async () => {
      const existingFile = new TFile('Test Folder/Test Note.md');
      mockVault.getAbstractFileByPath.mockReturnValue(existingFile);
      mockVault.create.mockResolvedValue(existingFile);

      const result = await importService.importNote(
        mockJoplinNote,
        'Test Folder',
        { conflictResolution: 'overwrite' }
      );

      expect(result.success).toBe(true);
      expect(mockVault.create).toHaveBeenCalled();
    });

    it('should handle import errors gracefully', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      mockVault.create.mockRejectedValue(new Error('Permission denied'));

      const result = await importService.importNote(mockJoplinNote, 'Test Folder');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('importMultipleNotes', () => {
    it('should import multiple notes successfully', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      mockVault.create.mockResolvedValue(new TFile(''));

      const results = await importService.importMultipleNotes(
        mockJoplinNotes,
        'Test Folder'
      );

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockVault.create).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure results', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      mockVault.create
        .mockResolvedValueOnce(new TFile('Test Folder/Test Note.md'))
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(new TFile('Test Folder/Note with Special Characters.md'));

      const results = await importService.importMultipleNotes(
        mockJoplinNotes,
        'Test Folder'
      );

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    it('should provide progress callback', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      mockVault.create.mockResolvedValue(new TFile(''));

      const progressCallback = vi.fn();

      await importService.importMultipleNotes(
        mockJoplinNotes,
        'Test Folder',
        {},
        progressCallback
      );

      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenCalledWith(1, 3);
      expect(progressCallback).toHaveBeenCalledWith(2, 3);
      expect(progressCallback).toHaveBeenCalledWith(3, 3);
    });
  });
});