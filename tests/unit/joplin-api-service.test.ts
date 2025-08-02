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
    service = new JoplinApiService('http://localhost:41184', 'test-token');
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
      const serviceWithTrailingSlash = new JoplinApiService('http://localhost:41184/', 'test-token');
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

  describe('searchByTag', () => {
    it('should search notes by tag', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockSearchResponse
      } as any);

      const result = await service.searchByTag('test');

      expect(result).toEqual(mockJoplinNotes);
      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'http://localhost:41184/search?query=tag:test&fields=id,title,body,created_time,updated_time,parent_id&token=test-token',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
    });

    it('should handle tags with special characters', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockEmptySearchResponse
      } as any);

      await service.searchByTag('test-tag with spaces');

      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'http://localhost:41184/search?query=tag:test-tag%20with%20spaces&fields=id,title,body,created_time,updated_time,parent_id&token=test-token',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
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