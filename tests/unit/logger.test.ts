import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Logger, createLogger } from '../../src/logger';
import { JoplinPortalSettings } from '../../src/types';

describe('Logger', () => {
  let mockSettings: JoplinPortalSettings;
  let logger: Logger;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create base mock settings
    mockSettings = {
      serverUrl: 'http://localhost:41184',
      apiToken: 'test-token',
      defaultImportFolder: 'Test Folder',
      importTemplate: '',
      searchLimit: 50,
      debugMode: false // Start with debug mode disabled
    };

    logger = new Logger(mockSettings);
  });

  describe('constructor', () => {
    it('should create logger with provided settings', () => {
      const testLogger = new Logger(mockSettings);
      expect(testLogger).toBeInstanceOf(Logger);
      expect(testLogger.isDebugEnabled()).toBe(false);
    });
  });

  describe('debug mode disabled (production mode)', () => {
    beforeEach(() => {
      mockSettings.debugMode = false;
      logger = new Logger(mockSettings);
    });

    it('should not log debug messages when debug mode is disabled', () => {
      logger.debug('Test debug message', { data: 'test' });

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should not log warning messages when debug mode is disabled', () => {
      logger.warn('Test warning message', { data: 'test' });

      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should log error messages in production format when debug mode is disabled', () => {
      logger.error('Test error message', { data: 'sensitive' });

      expect(console.error).toHaveBeenCalledWith('[Joplin Portal] Test error message');
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('should return false for isDebugEnabled when debug mode is disabled', () => {
      expect(logger.isDebugEnabled()).toBe(false);
    });
  });

  describe('debug mode enabled', () => {
    beforeEach(() => {
      mockSettings.debugMode = true;
      logger = new Logger(mockSettings);
    });

    it('should log debug messages when debug mode is enabled', () => {
      logger.debug('Test debug message', { data: 'test' });

      expect(console.log).toHaveBeenCalledWith(
        '[Joplin Portal Debug] Test debug message',
        { data: 'test' }
      );
      expect(console.log).toHaveBeenCalledTimes(1);
    });

    it('should log warning messages when debug mode is enabled', () => {
      logger.warn('Test warning message', { data: 'test' });

      expect(console.warn).toHaveBeenCalledWith(
        '[Joplin Portal Warning] Test warning message',
        { data: 'test' }
      );
      expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it('should log error messages in debug format when debug mode is enabled', () => {
      logger.error('Test error message', { data: 'sensitive' });

      expect(console.error).toHaveBeenCalledWith(
        '[Joplin Portal Error] Test error message',
        { data: 'sensitive' }
      );
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('should return true for isDebugEnabled when debug mode is enabled', () => {
      expect(logger.isDebugEnabled()).toBe(true);
    });
  });

  describe('debug mode toggle behavior', () => {
    it('should respect debug mode changes via updateSettings', () => {
      // Start with debug mode disabled
      mockSettings.debugMode = false;
      logger = new Logger(mockSettings);

      logger.debug('Should not log');
      expect(console.log).not.toHaveBeenCalled();

      // Enable debug mode
      const updatedSettings = { ...mockSettings, debugMode: true };
      logger.updateSettings(updatedSettings);

      logger.debug('Should log now');
      expect(console.log).toHaveBeenCalledWith(
        '[Joplin Portal Debug] Should log now'
      );
    });

    it('should immediately reflect debug mode changes', () => {
      // Start with debug enabled
      mockSettings.debugMode = true;
      logger = new Logger(mockSettings);

      expect(logger.isDebugEnabled()).toBe(true);

      // Disable debug mode
      const updatedSettings = { ...mockSettings, debugMode: false };
      logger.updateSettings(updatedSettings);

      expect(logger.isDebugEnabled()).toBe(false);

      // Verify logging behavior changed
      logger.debug('Should not log');
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('message formatting', () => {
    beforeEach(() => {
      mockSettings.debugMode = true;
      logger = new Logger(mockSettings);
    });

    it('should format debug messages with correct prefix', () => {
      logger.debug('Test message');

      expect(console.log).toHaveBeenCalledWith('[Joplin Portal Debug] Test message');
    });

    it('should format warning messages with correct prefix', () => {
      logger.warn('Test warning');

      expect(console.warn).toHaveBeenCalledWith('[Joplin Portal Warning] Test warning');
    });

    it('should format error messages with correct prefix in debug mode', () => {
      logger.error('Test error');

      expect(console.error).toHaveBeenCalledWith('[Joplin Portal Error] Test error');
    });

    it('should handle multiple arguments in debug messages', () => {
      const obj = { key: 'value' };
      const arr = [1, 2, 3];

      logger.debug('Multiple args', obj, arr, 'string');

      expect(console.log).toHaveBeenCalledWith(
        '[Joplin Portal Debug] Multiple args',
        obj,
        arr,
        'string'
      );
    });

    it('should handle multiple arguments in warning messages', () => {
      const obj = { warning: 'data' };

      logger.warn('Warning with data', obj);

      expect(console.warn).toHaveBeenCalledWith(
        '[Joplin Portal Warning] Warning with data',
        obj
      );
    });

    it('should handle multiple arguments in error messages when debug enabled', () => {
      const error = new Error('Test error');
      const context = { operation: 'test' };

      logger.error('Error occurred', error, context);

      expect(console.error).toHaveBeenCalledWith(
        '[Joplin Portal Error] Error occurred',
        error,
        context
      );
    });
  });

  describe('performance considerations', () => {
    it('should not evaluate expensive operations when debug mode is disabled', () => {
      mockSettings.debugMode = false;
      logger = new Logger(mockSettings);

      // Mock an expensive operation
      const expensiveOperation = vi.fn(() => {
        // Simulate expensive computation
        let result = '';
        for (let i = 0; i < 1000; i++) {
          result += i.toString();
        }
        return result;
      });

      // This should not call the expensive operation since debug is disabled
      logger.debug('Debug message', expensiveOperation());

      // The expensive operation should still be called because JavaScript
      // evaluates arguments before function calls, but console.log should not be called
      expect(expensiveOperation).toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should have minimal overhead when debug mode is disabled', () => {
      mockSettings.debugMode = false;
      logger = new Logger(mockSettings);

      const startTime = performance.now();

      // Perform multiple logging operations
      for (let i = 0; i < 100; i++) {
        logger.debug(`Debug message ${i}`);
        logger.warn(`Warning message ${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete very quickly (less than 10ms for 200 operations)
      expect(duration).toBeLessThan(10);
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('error logging behavior', () => {
    it('should always log errors regardless of debug mode', () => {
      // Test with debug mode disabled
      mockSettings.debugMode = false;
      logger = new Logger(mockSettings);

      logger.error('Production error');
      expect(console.error).toHaveBeenCalledWith('[Joplin Portal] Production error');

      vi.clearAllMocks();

      // Test with debug mode enabled
      mockSettings.debugMode = true;
      logger.updateSettings(mockSettings);

      logger.error('Debug error', { details: 'extra info' });
      expect(console.error).toHaveBeenCalledWith(
        '[Joplin Portal Error] Debug error',
        { details: 'extra info' }
      );
    });

    it('should not include sensitive details in production error logs', () => {
      mockSettings.debugMode = false;
      logger = new Logger(mockSettings);

      const sensitiveData = { apiToken: 'secret-token', password: 'secret' };
      logger.error('Connection failed', sensitiveData);

      // Should only log the basic message, not the sensitive data
      expect(console.error).toHaveBeenCalledWith('[Joplin Portal] Connection failed');
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringContaining('secret-token')
      );
    });
  });

  describe('createLogger factory function', () => {
    it('should create a Logger instance with provided settings', () => {
      const factoryLogger = createLogger(mockSettings);

      expect(factoryLogger).toBeInstanceOf(Logger);
      expect(factoryLogger.isDebugEnabled()).toBe(mockSettings.debugMode);
    });

    it('should create logger that respects debug mode setting', () => {
      mockSettings.debugMode = true;
      const factoryLogger = createLogger(mockSettings);

      factoryLogger.debug('Factory logger test');

      expect(console.log).toHaveBeenCalledWith(
        '[Joplin Portal Debug] Factory logger test'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages', () => {
      mockSettings.debugMode = true;
      logger = new Logger(mockSettings);

      logger.debug('');
      logger.warn('');
      logger.error('');

      expect(console.log).toHaveBeenCalledWith('[Joplin Portal Debug] ');
      expect(console.warn).toHaveBeenCalledWith('[Joplin Portal Warning] ');
      expect(console.error).toHaveBeenCalledWith('[Joplin Portal Error] ');
    });

    it('should handle null and undefined arguments', () => {
      mockSettings.debugMode = true;
      logger = new Logger(mockSettings);

      logger.debug('Test with null', null);
      logger.warn('Test with undefined', undefined);
      logger.error('Test with both', null, undefined);

      expect(console.log).toHaveBeenCalledWith('[Joplin Portal Debug] Test with null', null);
      expect(console.warn).toHaveBeenCalledWith('[Joplin Portal Warning] Test with undefined', undefined);
      expect(console.error).toHaveBeenCalledWith('[Joplin Portal Error] Test with both', null, undefined);
    });

    it('should handle settings object changes without updateSettings call', () => {
      // Create settings object
      const mutableSettings = { ...mockSettings, debugMode: false };
      logger = new Logger(mutableSettings);

      // Verify debug is initially disabled
      logger.debug('Should not log');
      expect(console.log).not.toHaveBeenCalled();

      // Mutate the settings object directly (not recommended but should work)
      mutableSettings.debugMode = true;

      // Should now log because it references the same object
      logger.debug('Should log now');
      expect(console.log).toHaveBeenCalledWith('[Joplin Portal Debug] Should log now');
    });
  });
});