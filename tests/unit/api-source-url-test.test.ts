import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JoplinApiService } from '../../src/joplin-api-service';
import { requestUrl } from 'obsidian';
import { Logger } from '../../src/logger';

vi.mock('obsidian', () => ({
  requestUrl: vi.fn()
}));

describe('API Source URL Test', () => {
  let joplinApiService: JoplinApiService;
  let mockRequestUrl: any;
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
      serverUrl: 'http://localhost:41184',
      apiToken: 'test-token',
      defaultImportFolder: 'Imported from Joplin',
      importTemplate: '',
      searchLimit: 50,
      debugMode: false,
      includeMetadataInFrontmatter: true
    };

    joplinApiService = new JoplinApiService(mockSettings, mockLogger);

    // Get the mocked requestUrl function
    mockRequestUrl = vi.mocked(requestUrl);
    vi.clearAllMocks();
  });

  describe('Search API includes source_url field', () => {
    it('should include source_url in default search fields', async () => {
      // Mock successful API response
      mockRequestUrl.mockResolvedValue({
        status: 200,
        json: {
          items: [
            {
              id: 'test-note-1',
              title: 'Test Note',
              body: 'Test content',
              created_time: 1640995200000,
              updated_time: 1640995200000,
              parent_id: 'folder-1',
              source_url: 'https://example.com/article'
            }
          ],
          has_more: false
        }
      });

      // Perform search
      await joplinApiService.searchNotes('test query');

      // Verify that the API was called with source_url in the fields
      expect(mockRequestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('fields=id%2Ctitle%2Cbody%2Ccreated_time%2Cupdated_time%2Cparent_id%2Csource_url')
        })
      );
    });

    it('should include source_url in tag search fields', async () => {
      // Mock successful API response
      mockRequestUrl.mockResolvedValue({
        status: 200,
        json: {
          items: [
            {
              id: 'test-note-1',
              title: 'Test Note',
              body: 'Test content',
              created_time: 1640995200000,
              updated_time: 1640995200000,
              parent_id: 'folder-1',
              source_url: 'https://example.com/article'
            }
          ],
          has_more: false
        }
      });

      // Perform tag search
      await joplinApiService.searchNotesByTags({
        tags: ['test'],
        operator: 'OR'
      });

      // Verify that the API was called with source_url in the fields
      expect(mockRequestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('fields=id%2Ctitle%2Cbody%2Ccreated_time%2Cupdated_time%2Cparent_id%2Csource_url')
        })
      );
    });

    it('should include source_url when getting individual notes', async () => {
      // Mock successful API response
      mockRequestUrl.mockResolvedValue({
        status: 200,
        json: {
          id: 'test-note-1',
          title: 'Test Note',
          body: 'Test content',
          created_time: 1640995200000,
          updated_time: 1640995200000,
          parent_id: 'folder-1',
          source_url: 'https://example.com/article'
        }
      });

      // Get individual note
      await joplinApiService.getNote('test-note-1');

      // Verify that the API was called with source_url in the fields
      expect(mockRequestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('fields=id%2Ctitle%2Cbody%2Ccreated_time%2Cupdated_time%2Cparent_id%2Csource_url')
        })
      );
    });
  });
});