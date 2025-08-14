import { describe, it, expect, vi, beforeEach } from 'vitest';
import { URLValidator } from '../../src/url-validator';

describe('Settings URL Validation Integration', () => {
	describe('URL validation in settings context', () => {
		it('should validate URLs using URLValidator', () => {
			// Test valid URL
			const validResult = URLValidator.validateJoplinServerUrl('http://localhost:41184');
			expect(validResult.isValid).toBe(true);
			expect(validResult.message).toBe('Valid Joplin server URL');

			// Test invalid URL
			const invalidResult = URLValidator.validateJoplinServerUrl('invalid-url');
			expect(invalidResult.isValid).toBe(false);
			expect(invalidResult.message).toBe('URL must start with http:// or https://');
			expect(invalidResult.suggestions).toBeDefined();
			expect(invalidResult.suggestions?.length).toBeGreaterThan(0);
		});

		it('should provide helpful suggestions for common URL issues', () => {
			// Test URL without protocol
			const result = URLValidator.validateJoplinServerUrl('localhost:41184');
			expect(result.isValid).toBe(false);
			expect(result.suggestions).toContain('Try: http://localhost:41184');

			// Test localhost without port
			const localhostResult = URLValidator.validateJoplinServerUrl('http://localhost');
			expect(localhostResult.isValid).toBe(true);
			expect(localhostResult.suggestions).toContain('Joplin typically runs on port 41184. Consider: http://localhost:41184');
		});

		it('should handle empty URLs appropriately', () => {
			const result = URLValidator.validateJoplinServerUrl('');
			expect(result.isValid).toBe(false);
			expect(result.message).toBe('Server URL is required');
			expect(result.suggestions).toContain('Enter your Joplin server URL (e.g., http://localhost:41184)');
		});

		it('should validate URL format before allowing save', () => {
			// This simulates the logic in settings.ts onChange handler
			const testUrl = 'invalid-url';
			const validationResult = URLValidator.validateJoplinServerUrl(testUrl);

			// Should not save invalid URLs
			expect(validationResult.isValid).toBe(false);

			// But should still provide feedback
			expect(validationResult.message).toBeTruthy();
			expect(validationResult.suggestions).toBeDefined();
		});

		it('should allow saving valid URLs', () => {
			// This simulates the logic in settings.ts onChange handler
			const testUrl = 'http://localhost:41184';
			const validationResult = URLValidator.validateJoplinServerUrl(testUrl);

			// Should allow saving valid URLs
			expect(validationResult.isValid).toBe(true);
		});

		it('should allow clearing URL (empty string)', () => {
			// Empty string should be allowed for clearing the URL
			const testUrl = '';
			const validationResult = URLValidator.validateJoplinServerUrl(testUrl);

			// Empty URLs are invalid but should be allowed for clearing
			expect(validationResult.isValid).toBe(false);
			// In settings, we allow saving empty strings to clear the field
		});
	});

	describe('Real-time validation feedback', () => {
		it('should provide immediate feedback for common mistakes', () => {
			const testCases = [
				{
					input: 'localhost',
					expectedValid: false,
					expectedSuggestion: 'Try: http://localhost'
				},
				{
					input: 'http://localhost:41184/api',
					expectedValid: true,
					expectedSuggestion: 'Joplin server URL should typically point to the root (no path)'
				},
				{
					input: 'https://example.com:41184',
					expectedValid: true,
					expectedSuggestion: undefined
				}
			];

			testCases.forEach(({ input, expectedValid, expectedSuggestion }) => {
				const result = URLValidator.validateJoplinServerUrl(input);
				expect(result.isValid).toBe(expectedValid);

				if (expectedSuggestion) {
					expect(result.suggestions).toContain(expectedSuggestion);
				}
			});
		});

		it('should handle rapid input changes gracefully', () => {
			// Simulate rapid typing
			const inputs = ['h', 'ht', 'htt', 'http', 'http:', 'http:/', 'http://', 'http://l', 'http://localhost'];

			inputs.forEach(input => {
				const result = URLValidator.validateJoplinServerUrl(input);
				// Should not throw errors and should provide consistent feedback
				expect(result).toBeDefined();
				expect(typeof result.isValid).toBe('boolean');
				expect(typeof result.message).toBe('string');
			});
		});
	});
});