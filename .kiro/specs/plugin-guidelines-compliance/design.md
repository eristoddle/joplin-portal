# Design Document

## Overview

This design addresses the Obsidian Plugin Guidelines compliance issues identified in the code review. The solution focuses on removing conflicts with core Obsidian functionality, cleaning up production code, and improving user experience through better validation and error handling.

## Architecture

The compliance fixes will be implemented across multiple layers of the existing architecture:

1. **Command Layer** - Remove default hotkeys from command definitions
2. **Settings Layer** - Add debug mode toggle and enhance URL validation
3. **Service Layer** - Implement conditional logging and improve error specificity
4. **Configuration Layer** - Update types and defaults to support new debug mode

## Components and Interfaces

### 1. Settings Interface Updates

```typescript
// Update JoplinPortalSettings interface
export interface JoplinPortalSettings {
    serverUrl: string;
    apiToken: string;
    defaultImportFolder: string;
    searchLimit: number;
    importTemplate: string;
    debugMode: boolean; // NEW: Debug mode toggle
}

// Update default settings
export const DEFAULT_SETTINGS: JoplinPortalSettings = {
    serverUrl: '',
    apiToken: '',
    defaultImportFolder: 'Imported from Joplin',
    searchLimit: 50,
    importTemplate: '',
    debugMode: false // NEW: Default to production mode
};
```

### 2. Logging Utility

Create a centralized logging utility that respects the debug mode setting:

```typescript
// New utility class for conditional logging
export class Logger {
    constructor(private settings: JoplinPortalSettings) {}

    debug(message: string, ...args: any[]): void {
        if (this.settings.debugMode) {
            console.log(`[Joplin Portal Debug] ${message}`, ...args);
        }
    }

    warn(message: string, ...args: any[]): void {
        if (this.settings.debugMode) {
            console.warn(`[Joplin Portal Warning] ${message}`, ...args);
        }
    }

    error(message: string, ...args: any[]): void {
        // Always log errors, but with debug context when available
        if (this.settings.debugMode) {
            console.error(`[Joplin Portal Error] ${message}`, ...args);
        } else {
            console.error(`[Joplin Portal] ${message}`);
        }
    }
}
```

### 3. Enhanced URL Validation

```typescript
// Enhanced URL validation with specific Joplin server checks
interface URLValidationResult {
    isValid: boolean;
    message: string;
    suggestions?: string[];
}

class URLValidator {
    static validateJoplinServerUrl(url: string): URLValidationResult {
        // Implementation details in tasks
    }
}
```

### 4. Enhanced Error Handling

```typescript
// Enhanced error categorization and messaging
interface EnhancedError {
    type: 'network' | 'authentication' | 'server' | 'configuration';
    userMessage: string;
    technicalDetails?: string;
    suggestions: string[];
}

class ErrorMessageBuilder {
    static buildUserFriendlyError(error: unknown, context: string): EnhancedError {
        // Implementation details in tasks
    }
}
```

## Data Models

### Debug Mode Configuration
- **Storage**: Persisted in plugin settings
- **Default**: `false` (production mode)
- **Scope**: Global plugin setting affecting all logging

### URL Validation State
- **Input**: User-provided server URL string
- **Output**: Validation result with specific feedback
- **Validation Rules**:
  - Must use http:// or https:// protocol
  - Must be a valid URL format
  - Should not include path segments (Joplin server root)

### Error Context
- **Error Type**: Categorized error classification
- **User Message**: Non-technical, actionable message
- **Technical Details**: Debug information (when debug mode enabled)
- **Suggestions**: Specific steps user can take to resolve

## Error Handling

### 1. Graceful Degradation
- Plugin continues to function even if debug mode toggle fails
- URL validation provides feedback but doesn't block basic functionality
- Enhanced error messages fall back to generic messages if categorization fails

### 2. Error Categories
- **Network Errors**: Connection refused, timeout, DNS resolution
- **Authentication Errors**: Invalid API token, expired credentials
- **Server Errors**: Joplin server not running, wrong port, API unavailable
- **Configuration Errors**: Invalid settings, missing required fields

### 3. User Feedback Strategy
- **Immediate Feedback**: Real-time validation in settings UI
- **Contextual Help**: Specific guidance based on error type
- **Progressive Disclosure**: Basic message with option to view technical details

## Testing Strategy

### 1. Unit Tests
- URL validation logic with various input formats
- Error message generation for different error types
- Logger utility behavior in debug/production modes

### 2. Integration Tests
- Settings persistence and retrieval of debug mode
- Command registration without hotkeys
- Error handling across service boundaries

### 3. Manual Testing
- Verify no hotkey conflicts with fresh Obsidian install
- Test debug mode toggle functionality
- Validate error messages in various failure scenarios
- Confirm clean console output in production mode

### 4. Regression Testing
- Ensure existing functionality remains intact
- Verify plugin loads and unloads cleanly
- Test all existing features work with new logging system

## Implementation Phases

### Phase 1: Critical Fixes (High Priority)
1. Remove default hotkeys from command definitions
2. Implement debug mode setting and conditional logging
3. Update all console.log statements to use new logging system

### Phase 2: Enhanced Validation (Medium Priority)
1. Implement enhanced URL validation
2. Add debug mode toggle to settings UI
3. Update error handling with specific messages

### Phase 3: Polish & Testing (Low Priority)
1. Comprehensive testing of all changes
2. Documentation updates
3. Final validation against Obsidian guidelines

## Migration Strategy

### Backward Compatibility
- New debug mode setting defaults to `false` (safe for existing users)
- Existing settings remain unchanged
- No breaking changes to public APIs

### Deployment Approach
- Changes can be deployed incrementally
- Each phase can be tested independently
- Rollback strategy: revert to previous logging if issues arise

## Performance Considerations

### Logging Performance
- Debug mode check is lightweight boolean operation
- No performance impact when debug mode disabled
- Conditional logging prevents string interpolation overhead

### Validation Performance
- URL validation runs only on user input (not on every request)
- Validation results can be cached for repeated checks
- Minimal impact on plugin startup time

## Security Considerations

### Information Disclosure
- Debug logging may expose sensitive information (API tokens, URLs)
- Debug mode should be clearly marked as potentially exposing sensitive data
- Production mode ensures minimal information leakage

### Input Validation
- Enhanced URL validation prevents malformed requests
- Proper error handling prevents information leakage through error messages
- Sanitized error messages for production users