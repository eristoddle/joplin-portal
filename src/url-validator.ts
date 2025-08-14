/**
 * URL validation utility for Joplin server URLs
 * Provides enhanced validation with specific error messages and suggestions
 */

export interface URLValidationResult {
    isValid: boolean;
    message: string;
    suggestions?: string[];
}

export class URLValidator {
    /**
     * Validates a Joplin server URL with specific checks for common issues
     * @param url The URL to validate
     * @returns Validation result with specific feedback
     */
    static validateJoplinServerUrl(url: string): URLValidationResult {
        // Handle empty or whitespace-only URLs
        if (!url || url.trim().length === 0) {
            return {
                isValid: false,
                message: "Server URL is required",
                suggestions: [
                    "Enter your Joplin server URL (e.g., http://localhost:41184)",
                    "Make sure Joplin desktop app is running with Web Clipper service enabled"
                ]
            };
        }

        const trimmedUrl = url.trim();

        // Check if URL has proper protocol format first
        if (!trimmedUrl.includes('://')) {
            return {
                isValid: false,
                message: "URL must start with http:// or https://",
                suggestions: [
                    `Try: http://${trimmedUrl}`,
                    `Or: https://${trimmedUrl}`,
                    "Most local Joplin servers use http://localhost:41184"
                ]
            };
        }

        // Try to parse as URL
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(trimmedUrl);
        } catch (error) {
            return {
                isValid: false,
                message: "Invalid URL format",
                suggestions: [
                    "Check for typos in the URL",
                    "Ensure the format is: http://hostname:port",
                    "Example: http://localhost:41184"
                ]
            };
        }

        // Validate protocol specifically
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return {
                isValid: false,
                message: "Only HTTP and HTTPS protocols are supported",
                suggestions: [
                    "Change the protocol to http:// or https://",
                    "Most Joplin servers use http://"
                ]
            };
        }

        // Check for common Joplin server patterns and provide guidance
        const hostname = parsedUrl.hostname.toLowerCase();
        const port = parsedUrl.port;

        // Warn about common issues but don't fail validation
        const warnings: string[] = [];

        // Check for localhost without port
        if (hostname === 'localhost' && !port) {
            warnings.push("Joplin typically runs on port 41184. Consider: http://localhost:41184");
        }

        // Check for suspicious paths
        if (parsedUrl.pathname && parsedUrl.pathname !== '/') {
            warnings.push("Joplin server URL should typically point to the root (no path)");
        }

        // Check for query parameters
        if (parsedUrl.search) {
            warnings.push("Joplin server URL should not include query parameters");
        }

        // URL is valid, but provide helpful suggestions if any
        return {
            isValid: true,
            message: warnings.length > 0 ? "URL is valid, but consider these suggestions:" : "Valid Joplin server URL",
            suggestions: warnings.length > 0 ? warnings : undefined
        };
    }

    /**
     * Quick validation check - returns only boolean result
     * @param url The URL to validate
     * @returns True if URL is valid, false otherwise
     */
    static isValidJoplinServerUrl(url: string): boolean {
        return this.validateJoplinServerUrl(url).isValid;
    }

    /**
     * Get suggestions for common URL format issues
     * @param url The problematic URL
     * @returns Array of suggestions to fix common issues
     */
    static getCommonSuggestions(url: string): string[] {
        const suggestions: string[] = [];

        if (!url || url.trim().length === 0) {
            suggestions.push("Enter your Joplin server URL");
            suggestions.push("Default local server: http://localhost:41184");
            return suggestions;
        }

        const trimmedUrl = url.trim();

        // Missing protocol
        if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
            suggestions.push(`Try: http://${trimmedUrl}`);
            suggestions.push("Most Joplin servers use http://");
        }

        // Common localhost patterns
        if (trimmedUrl.includes('localhost') && !trimmedUrl.includes(':41184')) {
            suggestions.push("Joplin default port is 41184: http://localhost:41184");
        }

        // IP address patterns
        if (/^\d+\.\d+\.\d+\.\d+/.test(trimmedUrl.replace(/^https?:\/\//, ''))) {
            suggestions.push("Make sure the IP address and port are correct");
            suggestions.push("Check that Joplin Web Clipper service is enabled");
        }

        return suggestions;
    }
}