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

        it('should handle URLs with userinfo (username:password)', () => {
            const result = URLValidator.validateJoplinServerUrl('http://user:pass@localhost:41184');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Valid Joplin server URL');
        });

        it('should handle URLs with only username in userinfo', () => {
            const result = URLValidator.validateJoplinServerUrl('http://user@localhost:41184');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Valid Joplin server URL');
        });

        it('should handle URLs with multiple path segments', () => {
            const result = URLValidator.validateJoplinServerUrl('http://localhost:41184/api/v1/notes');
            expect(result.isValid).toBe(true);
            expect(result.suggestions).toContain('Joplin server URL should typically point to the root (no path)');
        });

        it('should handle URLs with both path and query parameters', () => {
            const result = URLValidator.validateJoplinServerUrl('http://localhost:41184/api?token=abc&limit=10');
            expect(result.isValid).toBe(true);
            expect(result.suggestions).toContain('Joplin server URL should typically point to the root (no path)');
            expect(result.suggestions).toContain('Joplin server URL should not include query parameters');
        });

        it('should handle URLs with both query parameters and fragments', () => {
            const result = URLValidator.validateJoplinServerUrl('http://localhost:41184?token=abc#section');
            expect(result.isValid).toBe(true);
            expect(result.suggestions).toContain('Joplin server URL should not include query parameters');
        });
    });

    describe('specific Joplin server URL patterns', () => {
        it('should accept default Joplin server URL', () => {
            const result = URLValidator.validateJoplinServerUrl('http://localhost:41184');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Valid Joplin server URL');
            expect(result.suggestions).toBeUndefined();
        });

        it('should accept Joplin server on different localhost port', () => {
            const result = URLValidator.validateJoplinServerUrl('http://localhost:41185');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Valid Joplin server URL');
        });

        it('should accept Joplin server on 127.0.0.1', () => {
            const result = URLValidator.validateJoplinServerUrl('http://127.0.0.1:41184');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Valid Joplin server URL');
        });

        it('should accept Joplin server on local network IP', () => {
            const result = URLValidator.validateJoplinServerUrl('http://192.168.1.100:41184');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Valid Joplin server URL');
        });

        it('should accept Joplin server with domain name', () => {
            const result = URLValidator.validateJoplinServerUrl('http://joplin.local:41184');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Valid Joplin server URL');
        });

        it('should accept HTTPS Joplin server', () => {
            const result = URLValidator.validateJoplinServerUrl('https://joplin.example.com:41184');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Valid Joplin server URL');
        });

        it('should accept HTTPS Joplin server without explicit port', () => {
            const result = URLValidator.validateJoplinServerUrl('https://joplin.example.com');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Valid Joplin server URL');
        });

        it('should provide helpful suggestion for localhost without port', () => {
            const result = URLValidator.validateJoplinServerUrl('http://localhost');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('URL is valid, but consider these suggestions:');
            expect(result.suggestions).toContain('Joplin typically runs on port 41184. Consider: http://localhost:41184');
        });

        it('should provide helpful suggestion for 127.0.0.1 without port', () => {
            const result = URLValidator.validateJoplinServerUrl('http://127.0.0.1');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Valid Joplin server URL');
        });
    });

    describe('malformed URL patterns', () => {
        it('should reject URLs with invalid characters in hostname', () => {
            const result = URLValidator.validateJoplinServerUrl('http://local host:41184');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Invalid URL format');
            expect(result.suggestions).toContain('Check for typos in the URL');
        });

        it('should reject URLs with invalid high port numbers', () => {
            // Port 99999 is outside the valid range (0-65535) and causes URL constructor to throw
            const result = URLValidator.validateJoplinServerUrl('http://localhost:99999');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Invalid URL format');
        });

        it('should accept URLs with valid high port numbers', () => {
            // Port 65535 is the maximum valid port number
            const result = URLValidator.validateJoplinServerUrl('http://localhost:65535');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Valid Joplin server URL');
        });

        it('should reject URLs with negative port numbers', () => {
            const result = URLValidator.validateJoplinServerUrl('http://localhost:-1');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Invalid URL format');
        });

        it('should reject URLs with non-numeric port', () => {
            const result = URLValidator.validateJoplinServerUrl('http://localhost:abc');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Invalid URL format');
        });

        it('should handle URLs with double slashes in hostname', () => {
            // The URL constructor normalizes this to 'http://local/host:41184'
            const result = URLValidator.validateJoplinServerUrl('http://local//host:41184');
            expect(result.isValid).toBe(true);
            expect(result.suggestions).toContain('Joplin server URL should typically point to the root (no path)');
        });

        it('should reject URLs with missing hostname', () => {
            const result = URLValidator.validateJoplinServerUrl('http://:41184');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Invalid URL format');
        });

        it('should reject URLs with only protocol', () => {
            const result = URLValidator.validateJoplinServerUrl('http://');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Invalid URL format');
        });

        it('should reject URLs with unsupported protocols', () => {
            // Test protocols that are valid URL formats but not supported by Joplin
            const validProtocols = ['ftp', 'ws', 'wss'];
            validProtocols.forEach(protocol => {
                const result = URLValidator.validateJoplinServerUrl(`${protocol}://localhost:41184`);
                expect(result.isValid).toBe(false);
                expect(result.message).toBe('Only HTTP and HTTPS protocols are supported');
                expect(result.suggestions).toContain('Change the protocol to http:// or https://');
            });

            // Test protocols that cause URL constructor to throw
            const invalidProtocols = ['file', 'ssh', 'telnet'];
            invalidProtocols.forEach(protocol => {
                const result = URLValidator.validateJoplinServerUrl(`${protocol}://localhost:41184`);
                expect(result.isValid).toBe(false);
                // These might be caught as invalid URL format or unsupported protocol
                expect(['Invalid URL format', 'Only HTTP and HTTPS protocols are supported']).toContain(result.message);
            });
        });
    });

    describe('error message and suggestion quality', () => {
        it('should provide specific error message for empty URL', () => {
            const result = URLValidator.validateJoplinServerUrl('');
            expect(result.message).toBe('Server URL is required');
            expect(result.suggestions).toHaveLength(2);
            expect(result.suggestions![0]).toContain('Enter your Joplin server URL');
            expect(result.suggestions![1]).toContain('Make sure Joplin desktop app is running');
        });

        it('should provide specific error message for missing protocol', () => {
            const result = URLValidator.validateJoplinServerUrl('localhost:41184');
            expect(result.message).toBe('URL must start with http:// or https://');
            expect(result.suggestions).toContain('Try: http://localhost:41184');
            expect(result.suggestions).toContain('Most local Joplin servers use http://localhost:41184');
        });

        it('should provide specific error message for invalid protocol', () => {
            const result = URLValidator.validateJoplinServerUrl('ftp://localhost:41184');
            expect(result.message).toBe('Only HTTP and HTTPS protocols are supported');
            expect(result.suggestions).toContain('Change the protocol to http:// or https://');
            expect(result.suggestions).toContain('Most Joplin servers use http://');
        });

        it('should provide specific error message for malformed URL', () => {
            const result = URLValidator.validateJoplinServerUrl('http://[invalid');
            expect(result.message).toBe('Invalid URL format');
            expect(result.suggestions).toContain('Check for typos in the URL');
            expect(result.suggestions).toContain('Ensure the format is: http://hostname:port');
            expect(result.suggestions).toContain('Example: http://localhost:41184');
        });

        it('should provide appropriate warnings for valid but suboptimal URLs', () => {
            const result = URLValidator.validateJoplinServerUrl('http://localhost:41184/api?token=abc');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('URL is valid, but consider these suggestions:');
            expect(result.suggestions).toContain('Joplin server URL should typically point to the root (no path)');
            expect(result.suggestions).toContain('Joplin server URL should not include query parameters');
        });
    });
});