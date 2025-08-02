import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Notice } from 'obsidian';
import { ErrorHandler, JoplinApiError, ImportError } from '../../src/error-handler';

vi.mock('obsidian');

describe('ErrorHandler', () => {
  const mockNotice = vi.mocked(Notice);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleApiError', () => {
    it('should handle network errors', () => {
      const networkError: JoplinApiError = {
        message: 'Network Error',
        code: 'NETWORK_ERROR'
      };

      const result = ErrorHandler.handleApiError(networkError);

      expect(result.title).toBe('Connection Error');
      expect(result.message).toContain('Unable to connect to Joplin server');
      expect(result.severity).toBe('error');
    });

    it('should handle authentication errors', () => {
      const authError: JoplinApiError = {
        message: 'Unauthorized',
        status: 401,
        statusText: 'Unauthorized'
      };

      const result = ErrorHandler.handleApiError(authError);

      expect(result.title).toBe('Authentication Error');
      expect(result.message).toContain('Invalid API token');
      expect(result.severity).toBe('error');
    });

    it('should handle rate limiting errors', () => {
      const rateLimitError: JoplinApiError = {
        message: 'Too Many Requests',
        status: 429,
        statusText: 'Too Many Requests'
      };

      const result = ErrorHandler.handleApiError(rateLimitError);

      expect(result.title).toBe('Rate Limit Exceeded');
      expect(result.message).toContain('too many requests');
      expect(result.severity).toBe('warning');
    });

    it('should handle server errors', () => {
      const serverError: JoplinApiError = {
        message: 'Internal Server Error',
        status: 500,
        statusText: 'Internal Server Error'
      };

      const result = ErrorHandler.handleApiError(serverError);

      expect(result.title).toBe('Server Error');
      expect(result.message).toContain('Joplin server encountered an error');
      expect(result.severity).toBe('error');
    });

    it('should handle timeout errors', () => {
      const timeoutError: JoplinApiError = {
        message: 'Request timeout',
        code: 'TIMEOUT'
      };

      const result = ErrorHandler.handleApiError(timeoutError);

      expect(result.title).toBe('Request Timeout');
      expect(result.message).toContain('Request timed out');
      expect(result.severity).toBe('warning');
    });

    it('should handle unknown errors', () => {
      const unknownError: JoplinApiError = {
        message: 'Unknown error occurred'
      };

      const result = ErrorHandler.handleApiError(unknownError);

      expect(result.title).toBe('Unknown Error');
      expect(result.message).toContain('An unexpected error occurred');
      expect(result.severity).toBe('error');
    });
  });

  describe('handleImportError', () => {
    it('should handle file system permission errors', () => {
      const permissionError: ImportError = {
        message: 'Permission denied',
        code: 'EACCES',
        filePath: '/path/to/file.md'
      };

      const result = ErrorHandler.handleImportError(permissionError);

      expect(result.title).toBe('Permission Error');
      expect(result.message).toContain('Permission denied');
      expect(result.message).toContain('/path/to/file.md');
      expect(result.severity).toBe('error');
    });

    it('should handle file already exists errors', () => {
      const existsError: ImportError = {
        message: 'File already exists',
        code: 'EEXIST',
        filePath: '/path/to/existing.md'
      };

      const result = ErrorHandler.handleImportError(existsError);

      expect(result.title).toBe('File Conflict');
      expect(result.message).toContain('already exists');
      expect(result.severity).toBe('warning');
    });

    it('should handle disk space errors', () => {
      const spaceError: ImportError = {
        message: 'No space left on device',
        code: 'ENOSPC',
        filePath: '/path/to/file.md'
      };

      const result = ErrorHandler.handleImportError(spaceError);

      expect(result.title).toBe('Storage Error');
      expect(result.message).toContain('insufficient disk space');
      expect(result.severity).toBe('error');
    });

    it('should handle invalid filename errors', () => {
      const filenameError: ImportError = {
        message: 'Invalid filename',
        code: 'INVALID_FILENAME',
        filePath: '/path/to/invalid<>file.md'
      };

      const result = ErrorHandler.handleImportError(filenameError);

      expect(result.title).toBe('Invalid Filename');
      expect(result.message).toContain('contains invalid characters');
      expect(result.severity).toBe('error');
    });

    it('should handle unknown import errors', () => {
      const unknownError: ImportError = {
        message: 'Unknown import error',
        filePath: '/path/to/file.md'
      };

      const result = ErrorHandler.handleImportError(unknownError);

      expect(result.title).toBe('Import Error');
      expect(result.message).toContain('Failed to import');
      expect(result.severity).toBe('error');
    });
  });

  describe('showErrorNotice', () => {
    it('should show error notice with correct styling', () => {
      const error = {
        title: 'Test Error',
        message: 'This is a test error message',
        severity: 'error' as const
      };

      ErrorHandler.showErrorNotice(error);

      expect(mockNotice).toHaveBeenCalledWith(
        'Test Error: This is a test error message',
        5000
      );
    });

    it('should show warning notice with different duration', () => {
      const warning = {
        title: 'Test Warning',
        message: 'This is a test warning message',
        severity: 'warning' as const
      };

      ErrorHandler.showErrorNotice(warning);

      expect(mockNotice).toHaveBeenCalledWith(
        'Test Warning: This is a test warning message',
        3000
      );
    });

    it('should show info notice with shorter duration', () => {
      const info = {
        title: 'Test Info',
        message: 'This is a test info message',
        severity: 'info' as const
      };

      ErrorHandler.showErrorNotice(info);

      expect(mockNotice).toHaveBeenCalledWith(
        'Test Info: This is a test info message',
        2000
      );
    });
  });

  describe('logError', () => {
    it('should log error with context', () => {
      const consoleSpy = vi.spyOn(console, 'error');

      ErrorHandler.logError('Test operation failed', {
        operation: 'test',
        details: { id: '123' }
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Joplin Portal] Test operation failed',
        { operation: 'test', details: { id: '123' } }
      );
    });

    it('should log error without context', () => {
      const consoleSpy = vi.spyOn(console, 'error');

      ErrorHandler.logError('Simple error message');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Joplin Portal] Simple error message'
      );
    });
  });

  describe('isRetryableError', () => {
    it('should identify network errors as retryable', () => {
      const networkError: JoplinApiError = {
        message: 'Network Error',
        code: 'NETWORK_ERROR'
      };

      expect(ErrorHandler.isRetryableError(networkError)).toBe(true);
    });

    it('should identify timeout errors as retryable', () => {
      const timeoutError: JoplinApiError = {
        message: 'Timeout',
        code: 'TIMEOUT'
      };

      expect(ErrorHandler.isRetryableError(timeoutError)).toBe(true);
    });

    it('should identify 5xx server errors as retryable', () => {
      const serverError: JoplinApiError = {
        message: 'Internal Server Error',
        status: 500
      };

      expect(ErrorHandler.isRetryableError(serverError)).toBe(true);
    });

    it('should not identify auth errors as retryable', () => {
      const authError: JoplinApiError = {
        message: 'Unauthorized',
        status: 401
      };

      expect(ErrorHandler.isRetryableError(authError)).toBe(false);
    });

    it('should not identify client errors as retryable', () => {
      const clientError: JoplinApiError = {
        message: 'Bad Request',
        status: 400
      };

      expect(ErrorHandler.isRetryableError(clientError)).toBe(false);
    });
  });
});