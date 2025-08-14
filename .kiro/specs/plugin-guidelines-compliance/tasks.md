# Implementation Plan

## Phase 1: Critical Fixes (High Priority)

- [x] 1. Remove default hotkeys from command definitions
  - Remove `hotkeys` property from all command definitions in `main.ts`
  - Update commands: 'focus-joplin-search', 'select-all-joplin-import', 'import-selected-joplin-notes'
  - Test that commands still work but without default hotkeys
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Add debug mode setting to plugin configuration
  - Update `JoplinPortalSettings` interface in `src/types.ts` to include `debugMode: boolean`
  - Update `DEFAULT_SETTINGS` to include `debugMode: false`
  - Ensure settings persistence works with new field
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 3. Create centralized logging utility
  - Create new `src/logger.ts` file with Logger class
  - Implement debug(), warn(), and error() methods with conditional logging
  - Logger should accept settings object to check debug mode
  - Add proper TypeScript types and JSDoc documentation
  - _Requirements: 2.1, 2.2, 2.3, 5.2, 5.3_

- [x] 4. Replace console logging in main plugin file
  - Update `main.ts` to use new Logger utility instead of direct console calls
  - Replace console.log statements in onload(), onunload(), and offline detection methods
  - Ensure critical errors are still logged appropriately
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 5. Replace console logging in API service
  - Update `src/joplin-api-service.ts` to use Logger utility
  - Replace all console.log, console.warn statements with conditional logging
  - Maintain error logging for debugging while cleaning up debug noise
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 6. Replace console logging in remaining service files
  - Update `src/import-service.ts`, `src/error-handler.ts`, `src/retry-utility.ts`
  - Replace console statements with Logger utility calls
  - Ensure import progress and error information is still available in debug mode
  - _Requirements: 2.1, 2.2, 2.4_

## Phase 2: Enhanced Validation & UI (Medium Priority)

- [x] 7. Add debug mode toggle to settings UI
  - Add debug mode setting to `src/settings.ts` settings tab
  - Include clear description about what debug mode does
  - Add warning about potential sensitive information exposure
  - Test toggle functionality and settings persistence
  - _Requirements: 5.1, 5.4_

- [x] 8. Implement enhanced URL validation
  - Create URL validation utility in `src/url-validator.ts`
  - Add specific validation for http/https protocols
  - Validate URL format and provide specific error messages
  - Add suggestions for common URL format issues
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 9. Integrate enhanced URL validation in settings
  - Update settings UI to use new URL validation
  - Show real-time validation feedback as user types
  - Display helpful error messages and suggestions
  - Prevent saving invalid URLs with clear user guidance
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 10. Enhance error message specificity in API service
  - Update error handling in `src/joplin-api-service.ts`
  - Differentiate between network, authentication, and server errors
  - Provide specific user-friendly messages for each error type
  - Include troubleshooting suggestions in error messages
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 11. Enhance error messages in import service
  - Update error handling in `src/import-service.ts`
  - Provide specific error messages for import failures
  - Include context about what was being imported when error occurred
  - Add suggestions for resolving common import issues
  - _Requirements: 4.1, 4.2_

## Phase 3: Testing & Validation (Low Priority)

- [ ] 12. Create unit tests for logging utility
  - Write tests for Logger class behavior in debug and production modes
  - Test that debug mode toggle affects logging output
  - Verify error logging works in both modes
  - Ensure no performance impact when debug mode disabled
  - _Requirements: 2.1, 2.2, 2.3, 5.2, 5.3_

- [ ] 13. Create unit tests for URL validation
  - Write tests for various URL formats (valid and invalid)
  - Test specific Joplin server URL patterns
  - Verify error messages and suggestions are appropriate
  - Test edge cases and malformed URLs
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 14. Test command functionality without default hotkeys
  - Verify all commands work when invoked through command palette
  - Test that users can assign custom hotkeys through Obsidian settings
  - Confirm no conflicts with Obsidian core shortcuts
  - Test with other popular plugins to ensure no conflicts
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 15. Integration testing of enhanced error handling
  - Test error scenarios: network failures, authentication issues, server unavailable
  - Verify appropriate error messages are shown to users
  - Test error handling in both debug and production modes
  - Ensure error messages provide actionable guidance
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 16. Final compliance validation and cleanup
  - Review all changes against Obsidian Plugin Guidelines
  - Verify no console logging in production mode
  - Confirm no default hotkeys are defined
  - Test plugin loading/unloading with all changes
  - Update documentation and README if needed
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_