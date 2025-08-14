import { describe, it, expect } from 'vitest';
import { URLValidator, URLValidationResult } from '../../src/url-validator';

describe('URLValidator', () => {
    describe('validateJoplinServerUrl', () => {
        it('should reject empty URLs', () => {
            const result = URLValidator.validateJoplinServerUrl('');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Server URL is required');
            expect(result.suggestions).toContain('Enter your Joplin server URL (e.g., http://localhost:41184)');
        });

        it('should reject whitespace-only URLs', () => {
            const result = URLValidator.validateJoplinServerUrl('   ');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Server URL is required');
        });

        it('should reject URLs without protocol', () => {
            const result = URLValidator.validateJoplinServerUrl('localhost:41184');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('URL must start with http:// or https://');
            expect(result.suggestions).toContain('Try: http://localhost:41184');
        });

        it('should reject URLs with invalid protocols', () => {
            const result = URLValidator.validateJoplinServerUrl('ftp://localhost:41184');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Only HTTP and HTTPS protocols are supported');
        });

        it('should reject malformed URLs', () => {
            const result = URLValidator.validateJoplinServerUrl('http://[invalid-url');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Invalid URL format');
            expect(result.suggestions).toContain('Check for typos in the URL');
        });

        it('should accept valid HTTP URLs', () => {
            const result = URLValidator.validateJoplinServerUrl('http://localhost:41184');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Valid Joplin server URL');
        });

        it('should accept valid HTTPS URLs', () => {
            const result = URLValidator.validateJoplinServerUrl('https://joplin.example.com');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Valid Joplin server URL');
        });

        it('should provide suggestions for localhost without port', () => {
            const result = URLValidator.validateJoplinServerUrl('http://localhost');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('URL is valid, but consider these suggestions:');
            expect(result.suggestions).toContain('Joplin typically runs on port 41184. Consider: http://localhost:41184');
        });

        it('should warn about paths in URL', () => {
            const result = URLValidator.validateJoplinServerUrl('http://localhost:41184/api');
            expect(result.isValid).toBe(true);
            expect(result.suggestions).toContain('Joplin server URL should typically point to the root (no path)');
        });

        it('should warn about query parameters', () => {
            const result = URLValidator.validateJoplinServerUrl('http://localhost:41184?token=abc');
            expect(result.isValid).toBe(true);
            expect(result.suggestions).toContain('Joplin server URL should not include query parameters');
        });

        it('should handle IP addresses', (
) => {
            const result = URLValidator.validateJoplinServerUrl('http://192.168.1.100:41184');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Valid Joplin server URL');
        });

        it('should trim whitespace from URLs', () => {
            const result = URLValidator.validateJoplinServerUrl('  http://localhost:41184  ');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Valid Joplin server URL');
        });
    });

    describe('isValidJoplinServerUrl', () => {
        it('should return true for valid URLs', () => {
            expect(URLValidator.isValidJoplinServerUrl('http://localhost:41184')).toBe(true);
            expect(URLValidator.isValidJoplinServerUrl('https://joplin.example.com')).toBe(true);
        });

        it('should return false for invalid URLs', () => {
            expect(URLValidator.isValidJoplinServerUrl('')).toBe(false);
            expect(URLValidator.isValidJoplinServerUrl('localhost:41184')).toBe(false);
            expect(URLValidator.isValidJoplinServerUrl('ftp://localhost:41184')).toBe(false);
        });
    });

    describe('getCommonSuggestions', () => {
        it('should provide default suggestions for empty URLs', () => {
            const suggestions = URLValidator.getCommonSuggestions('');
            expect(suggestions).toContain('Enter your Joplin server URL');
            expect(suggestions).toContain('Default local server: http://localhost:41184');
        });

        it('should suggest adding protocol', () => {
            const suggestions = URLValidator.getCommonSuggestions('localhost:41184');
            expect(suggestions).toContain('Try: http://localhost:41184');
            expect(suggestions).toContain('Most Joplin servers use http://');
        });

        it('should suggest default port for localhost', () => {
            const suggestions = URLValidator.getCommonSuggestions('localhost');
            expect(suggestions).toContain('Joplin default port is 41184: http://localhost:41184');
        });

        it('should provide IP address guidance', () => {
            const suggestions = URLValidator.getCommonSuggestions('192.168.1.100');
            expect(suggestions).toContain('Make sure the IP address and port are correct');
            expect(suggestions).toContain('Check that Joplin Web Clipper service is enabled');
        });

        it('should handle URLs with protocol correctly', () => {
            const suggestions = URLValidator.getCommonSuggestions('http://localhost');
            expect(suggestions).toContain('Joplin default port is 41184: http://localhost:41184');
        });
    });

    describe('edge cases', () => {
        it('should handle null input gracefully', () => {
            const result = URLValidator.validateJoplinServerUrl(null as any);
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Server URL is required');
        });

        it('should handle undefined input gracefully', () => {
            const result = URLValidator.validateJoplinServerUrl(undefined as any);
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Server URL is required');
        });

        it('should handle very long URLs', () => {
            const longUrl = 'http://localhost:41184/' + 'a'.repeat(1000);
            const result = URLValidator.validateJoplinServerUrl(longUrl);
            expect(result.isValid).toBe(true);
            expect(result.suggestions).toContain('Joplin server URL should typically point to the root (no path)');
        });

        it('should handle URLs with special characters', () => {
            const result = URLValidator.validateJoplinServerUrl('http://localhost:41184/path%20with%20spaces');
            expect(result.isValid).toBe(true);
            expect(result.suggestions).toContain('Joplin server URL should typically point to the root (no path)');
        });

        it('should handle URLs with fragments', () => {
            const result = URLValidator.validateJoplinServerUrl('http://localhost:41184#fragment');
            expect(result.isValid).toBe(true);
        });

        it('should handle non-standard ports', () => {
            const result = URLValidator.validateJoplinServerUrl('http://localhost:8080');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Valid Joplin server URL');
        });
    });
});