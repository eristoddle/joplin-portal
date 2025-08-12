import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Notice } from 'obsidian';
import { ErrorHandler } from '../../src/error-handler';
import { JoplinApiError } from '../../src/types';

vi.mock('obsidian');

describe('ErrorHandler', () => {
  const mockNotice = vi.mocked(Notice);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleApiError', () => {
    it('should handle network errors', () => {
      const networkError = new Error('Network Error') as JoplinApiError;
      networkError.status = 0;

      const result = ErrorHandler.handleApiError(networkError);

      expect(result.message).toContain('Unable to connect to Joplin server');
      expect(result.severity).toBe('error');
    });

    it('should handle authentication errors', () => {
      const authError = new Error('Unauthorized') as JoplinApiError;
      authError.status = 401;

      const result = ErrorHandler.handleApiError(authError);

      expect(result.message).toContain('Authentication failed');
      expect(result.severity).toBe('error');
    });

    it('should handle rate limiting errors', () => {
      const rateLimitError = new Error('Too Many Requests') as JoplinApiError;
      rateLimitError.status = 429;

      const result = ErrorHandler.handleApiError(rateLimitError);

      expect(result.message).toContain('Too many requests');
      expect(result.severity).toBe('warning');
    });

    it('should handle server errors', () => {
      const serverError = new Error('Internal Server Error') as JoplinApiError;
      serverError.status = 500;

      const result = ErrorHandler.handleApiError(serverError);

      expect(result.message).toContain('Joplin server error');
      expect(result.severity).toBe('error');
    });

    it('should handle timeout errors', () => {
      const timeoutError = new Error('Request timeout');

      const result = ErrorHandler.handleApiError(timeoutError);

      expect(result.message).toContain('Request timed out');
      expect(result.severity).toBe('warning');
    });

    it('should handle unknown errors', () => {
      const unknownError = new Error('Unknown error occurred');

      const result = ErrorHandler.handleApiError(unknownError);

      expect(result.message).toContain('An error occurred');
      expect(result.severity).toBe('error');
    });
  });

  describe('handleImportError', () => {
    it('should handle file system permission errors', () => {
      const permissionError = new Error('permission denied');

      const result = ErrorHandler.handleImportError(permissionError, 'Test Note');

      expect(result.message).toContain('Permission denied importing "Test Note"');
      expect(result.severity).toBe('error');
    });

    it('should handle file already exists errors', () => {
      const existsError = new Error('File already exists');

      const result = ErrorHandler.handleImportError(existsError, 'Test Note');

      expect(result.message).toContain('Import skipped: "Test Note"');
      expect(result.severity).toBe('warning');
    });

    it('should handle disk space errors', () => {
      const spaceError = new Error('ENOSPC: no space left on device');

      const result = ErrorHandler.handleImportError(spaceError, 'Test Note');

      expect(result.message).toContain('Not enough disk space');
      expect(result.severity).toBe('error');
    });

    it('should handle invalid filename errors', () => {
      const filenameError = new Error('Invalid filename characters');

      const result = ErrorHandler.handleImportError(filenameError, 'Test Note');

      expect(result.message).toContain('Failed to import "Test Note"');
      expect(result.severity).toBe('error');
    });

    it('should handle unknown import errors', () => {
      const unknownError = new Error('Unknown import error');

      const result = ErrorHandler.handleImportError(unknownError, 'Test Note');

      expect(result.message).toContain('Failed to import "Test Note"');
      expect(result.severity).toBe('error');
    });
  });

  describe('showErrorNotice', () => {
    it('should show error notice with correct styling', () => {
      const error = {
        message: 'This is a test error message',
        severity: 'error' as const
      };

      ErrorHandler.showErrorNotice(error);

      expect(mockNotice).toHaveBeenCalledWith(
        '❌ This is a test error message',
        8000
      );
    });

    it('should show warning notice with different duration', () => {
      const warning = {
        message: 'This is a test warning message',
        severity: 'warning' as const
      };

      ErrorHandler.showErrorNotice(warning);

      expect(mockNotice).toHaveBeenCalledWith(
        '⚠️ This is a test warning message',
        8000
      );
    });

    it('should show info notice with shorter duration', () => {
      const info = {
        message: 'This is a test info message',
        severity: 'info' as const
      };

      ErrorHandler.showErrorNotice(info);

      expect(mockNotice).toHaveBeenCalledWith(
        'ℹ️ This is a test info message',
        8000
      );
    });
  });

  describe('logDetailedError', () => {
    it('should log error with context', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const testError = new Error('Test operation failed');

      ErrorHandler.logDetailedError(testError, 'test operation', {
        operation: 'test',
        details: { id: '123' }
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Joplin Portal Detailed Error:',
        expect.objectContaining({
          context: 'test operation',
          error: expect.objectContaining({
            name: 'Error',
            message: 'Test operation failed'
          }),
          additionalInfo: {
            operation: 'test',
            details: { id: '123' }
          }
        })
      );
    });

    it('should log error without additional info', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const testError = new Error('Simple error message');

      ErrorHandler.logDetailedError(testError, 'simple test');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Joplin Portal Detailed Error:',
        expect.objectContaining({
          context: 'simple test',
          error: expect.objectContaining({
            name: 'Error',
            message: 'Simple error message'
          })
        })
      );
    });
  });

  describe('isRetryableError', () => {
    it('should identify network errors as retryable', () => {
      const networkError = new Error('connection failed');

      expect(ErrorHandler.isRetryableError(networkError)).toBe(true);
    });

    it('should identify timeout errors as retryable', () => {
      const timeoutError = new Error('request timeout');

      expect(ErrorHandler.isRetryableError(timeoutError)).toBe(true);
    });

    it('should identify specific 5xx server errors as retryable', () => {
      const serverError503 = new Error('Service Unavailable') as JoplinApiError;
      serverError503.status = 503;

      expect(ErrorHandler.isRetryableError(serverError503)).toBe(true);

      const serverError502 = new Error('Bad Gateway') as JoplinApiError;
      serverError502.status = 502;

      expect(ErrorHandler.isRetryableError(serverError502)).toBe(true);
    });

    it('should not identify auth errors as retryable', () => {
      const authError = new Error('Unauthorized') as JoplinApiError;
      authError.status = 401;

      expect(ErrorHandler.isRetryableError(authError)).toBe(false);
    });

    it('should not identify client errors as retryable', () => {
      const clientError = new Error('Bad Request') as JoplinApiError;
      clientError.status = 400;

      expect(ErrorHandler.isRetryableError(clientError)).toBe(false);
    });
  });
});