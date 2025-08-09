import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestUrl } from 'obsidian';
import { JoplinApiService } from '../../src/joplin-api-service';
import {
  mockJoplinNote,
  mockJoplinNotes,
  mockSearchResponse,
  mockEmptySearchResponse,
  mockApiError,
  mockNetworkError,
  mockAuthError
} from '../mocks/joplin-api-mocks';

vi.mock('obsidian');

describe('JoplinApiService', () => {
  let service: JoplinApiService;
  const mockRequestUrl = vi.mocked(requestUrl);

  beforeEach(() => {
    service = new JoplinApiService({
      serverUrl: 'http://localhost:41184',
      apiToken: 'test-token',
      defaultImportFolder: 'Imported from Joplin',
      importTemplate: '',
      searchLimit: 50
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with server URL and token', () => {
      expect(service).toBeDefined();
      expect(service['baseUrl']).toBe('http://localhost:41184');
      expect(service['token']).toBe('test-token');
    });

    it('should normalize server URL by removing trailing slash', () => {
      const serviceWithTrailingSlash = new JoplinApiService({
        serverUrl: 'http://localhost:41184/',
        apiToken: 'test-token',
        defaultImportFolder: 'Imported from Joplin',
        importTemplate: '',
        searchLimit: 50
      });
      expect(serviceWithTrailingSlash['baseUrl']).toBe('http://localhost:41184');
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: { version: '2.8.8' }
      } as any);

      const result = await service.testConnection();

      expect(result).toBe(true);
      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'http://localhost:41184/ping?token=test-token',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
    });

    it('should return false for failed connection', async () => {
      mockRequestUrl.mockRejectedValueOnce(mockNetworkError);

      const result = await service.testConnection();

      expect(result).toBe(false);
    });

    it('should return false for unauthorized access', async () => {
      mockRequestUrl.mockRejectedValueOnce(mockAuthError);

      const result = await service.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('searchNotes', () => {
    it('should search notes successfully', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockSearchResponse
      } as any);

      const result = await service.searchNotes('test query');

      expect(result).toEqual(mockJoplinNotes);
      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'http://localhost:41184/search?query=test%20query&fields=id,title,body,created_time,updated_time,parent_id&token=test-token',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
    });

    it('should handle empty search results', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockEmptySearchResponse
      } as any);

      const result = await service.searchNotes('nonexistent');

      expect(result).toEqual([]);
    });

    it('should handle search with options', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockSearchResponse
      } as any);

      const result = await service.searchNotes('test', { limit: 10, page: 1 });

      expect(result).toEqual(mockJoplinNotes);
      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'http://localhost:41184/search?query=test&fields=id,title,body,created_time,updated_time,parent_id&limit=10&page=1&token=test-token',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
    });

    it('should throw error for API failures', async () => {
      mockRequestUrl.mockRejectedValueOnce(mockApiError);

      await expect(service.searchNotes('test')).rejects.toThrow('API Error');
    });

    it('should encode special characters in query', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockEmptySearchResponse
      } as any);

      await service.searchNotes('test & query with spaces');

      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'http://localhost:41184/search?query=test%20%26%20query%20with%20spaces&fields=id,title,body,created_time,updated_time,parent_id&token=test-token',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
    });
  });

  describe('getNote', () => {
    it('should retrieve a single note', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockJoplinNote
      } as any);

      const result = await service.getNote('test-note-1');

      expect(result).toEqual(mockJoplinNote);
      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'http://localhost:41184/notes/test-note-1?fields=id,title,body,created_time,updated_time,parent_id&token=test-token',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
    });

    it('should throw error for non-existent note', async () => {
      mockRequestUrl.mockRejectedValueOnce({
        message: 'Not Found',
        status: 404,
        statusText: 'Not Found'
      });

      await expect(service.getNote('non-existent')).rejects.toThrow('Not Found');
    });
  });

  describe('searchNotesByTags', () => {
    it('should search notes by single tag with proper format', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockSearchResponse
      } as any);

      const result = await service.searchNotesByTags({
        tags: ['test'],
        operator: 'OR'
      });

      expect(result).toHaveLength(mockJoplinNotes.length);
      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: expect.stringContaining('search?query=tag%3Atest'),
        method: 'GET',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' })
      });
    });

    it('should search notes by multiple tags with OR operator', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockSearchResponse
      } as any);

      const result = await service.searchNotesByTags({
        tags: ['work', 'project'],
        operator: 'OR'
      });

      expect(result).toHaveLength(mockJoplinNotes.length);
      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: expect.stringContaining('tag%3Awork%20OR%20tag%3Aproject'),
        method: 'GET',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' })
      });
    });

    it('should search notes by multiple tags with AND operator', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockSearchResponse
      } as any);

      const result = await service.searchNotesByTags({
        tags: ['work', 'urgent'],
        operator: 'AND'
      });

      expect(result).toHaveLength(mockJoplinNotes.length);
      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: expect.stringContaining('tag%3Awork%20tag%3Aurgent'),
        method: 'GET',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' })
      });
    });

    it('should handle tags with spaces by replacing with underscores', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockEmptySearchResponse
      } as any);

      await service.searchNotesByTags({
        tags: ['test tag with spaces'],
        operator: 'OR'
      });

      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: expect.stringContaining('tag%3Atest_tag_with_spaces'),
        method: 'GET',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' })
      });
    });

    it('should combine tag search with text search when includeText is true', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockSearchResponse
      } as any);

      await service.searchNotesByTags({
        tags: ['work'],
        operator: 'OR',
        includeText: true,
        textQuery: 'meeting notes'
      });

      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: expect.stringContaining('tag%3Awork%20meeting%20notes'),
        method: 'GET',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' })
      });
    });

    it('should return empty array for empty tags', async () => {
      const result = await service.searchNotesByTags({
        tags: [],
        operator: 'OR'
      });

      expect(result).toEqual([]);
      expect(mockRequestUrl).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      mockRequestUrl.mockRejectedValueOnce(mockApiError);

      const result = await service.searchNotesByTags({
        tags: ['test'],
        operator: 'OR'
      });

      expect(result).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle network timeouts', async () => {
      mockRequestUrl.mockRejectedValueOnce({
        message: 'Request timeout',
        code: 'TIMEOUT'
      });

      await expect(service.searchNotes('test')).rejects.toThrow('Request timeout');
    });

    it('should handle rate limiting', async () => {
      mockRequestUrl.mockRejectedValueOnce({
        message: 'Too Many Requests',
        status: 429,
        statusText: 'Too Many Requests'
      });

      await expect(service.searchNotes('test')).rejects.toThrow('Too Many Requests');
    });
  });
});