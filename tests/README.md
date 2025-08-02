# Joplin Portal Test Suite

This directory contains a comprehensive test suite for the Joplin Portal plugin, covering unit tests, integration tests, and mock implementations.

## Test Structure

```
tests/
├── setup.ts                    # Test environment setup
├── mocks/                      # Mock implementations
│   ├── obsidian-mock.ts        # Obsidian API mocks
│   └── joplin-api-mocks.ts     # Joplin API response mocks
├── unit/                       # Unit tests
│   ├── basic.test.ts           # Basic functionality tests (working)
│   ├── joplin-api-service.test.ts    # API service tests
│   ├── import-service.test.ts        # Import functionality tests
│   ├── error-handler.test.ts         # Error handling tests
│   ├── retry-utility.test.ts         # Retry logic tests
│   └── settings.test.ts              # Settings management tests
└── integration/                # Integration tests
    ├── search-workflow.test.ts       # End-to-end search tests
    └── import-workflow.test.ts       # End-to-end import tests
```

## Test Coverage

### Unit Tests

#### JoplinApiService Tests (`joplin-api-service.test.ts`)
- **Connection Testing**: Validates server connectivity and authentication
- **Search Functionality**: Tests note searching with various parameters
- **Note Retrieval**: Tests individual note fetching
- **Tag-based Search**: Tests searching by tags
- **Error Handling**: Tests API error scenarios (network, auth, rate limiting)
- **URL Encoding**: Tests proper encoding of search queries

#### ImportService Tests (`import-service.test.ts`)
- **Markdown Conversion**: Tests Joplin to Obsidian format conversion
- **File Name Generation**: Tests safe filename creation from note titles
- **Import Operations**: Tests single and batch note imports
- **Conflict Resolution**: Tests handling of existing files (skip/overwrite/rename)
- **Folder Creation**: Tests automatic folder creation
- **Progress Tracking**: Tests import progress callbacks

#### ErrorHandler Tests (`error-handler.test.ts`)
- **API Error Handling**: Tests conversion of API errors to user-friendly messages
- **Import Error Handling**: Tests file system error handling
- **Error Display**: Tests error notification display
- **Error Logging**: Tests error logging functionality
- **Retry Logic**: Tests identification of retryable errors

#### RetryUtility Tests (`retry-utility.test.ts`)
- **Exponential Backoff**: Tests retry delay calculation
- **Max Attempts**: Tests retry limit enforcement
- **Success Scenarios**: Tests successful operations on retry
- **Custom Retry Logic**: Tests custom shouldRetry functions
- **Callback Handling**: Tests onRetry callback execution

#### Settings Tests (`settings.test.ts`)
- **UI Generation**: Tests settings interface creation
- **Value Updates**: Tests setting value changes and persistence
- **Validation**: Tests input validation (URLs, tokens, folder names)
- **Connection Testing**: Tests connection validation in settings
- **Error Display**: Tests validation error display

### Integration Tests

#### Search Workflow Tests (`search-workflow.test.ts`)
- **Complete Search Flow**: Tests search input → API call → results display
- **Empty Results**: Tests handling of no search results
- **Search Debouncing**: Tests input debouncing to prevent excessive API calls
- **Error Handling**: Tests search error scenarios
- **Note Preview**: Tests note preview functionality
- **Result Selection**: Tests multi-select functionality for import
- **Keyboard Navigation**: Tests keyboard shortcuts and navigation

#### Import Workflow Tests (`import-workflow.test.ts`)
- **End-to-End Import**: Tests complete import process from selection to completion
- **Import Options**: Tests folder selection and conflict resolution options
- **Progress Display**: Tests import progress indicators
- **Batch Operations**: Tests importing multiple notes simultaneously
- **Error Recovery**: Tests handling of partial import failures
- **Post-Import Actions**: Tests cleanup and user feedback after import

### Mock Implementations

#### Obsidian API Mocks (`obsidian-mock.ts`)
- **Plugin Class**: Mock Obsidian Plugin base class
- **ItemView**: Mock sidebar view component
- **PluginSettingTab**: Mock settings interface
- **File System**: Mock TFile and TFolder classes
- **Utilities**: Mock Notice, requestUrl, and other utilities

#### Joplin API Mocks (`joplin-api-mocks.ts`)
- **Sample Notes**: Realistic Joplin note data for testing
- **API Responses**: Mock API response structures
- **Error Scenarios**: Mock error conditions (network, auth, server errors)
- **Edge Cases**: Empty results, pagination, special characters

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run specific test file
npx vitest tests/unit/basic.test.ts --run
```

## Test Configuration

The test suite uses:
- **Vitest**: Modern test runner with TypeScript support
- **jsdom**: Browser environment simulation
- **Mock Functions**: Comprehensive mocking of external dependencies

### Configuration Files
- `vitest.config.ts`: Vitest configuration with aliases and environment setup
- `tests/setup.ts`: Global test setup and mock initialization

## Test Scenarios Covered

### Happy Path Scenarios
- Successful connection to Joplin server
- Successful search with results
- Successful note import without conflicts
- Proper settings validation and saving

### Error Scenarios
- Network connectivity issues
- Authentication failures
- API rate limiting
- File system permission errors
- Invalid user inputs
- Malformed API responses

### Edge Cases
- Empty search results
- Very long note titles
- Special characters in filenames
- Large batch imports
- Concurrent operations
- Memory constraints

### Performance Scenarios
- Search debouncing effectiveness
- Retry logic efficiency
- Large result set handling
- Progress callback frequency

## Mock Data Quality

The mock data includes:
- Realistic note content with markdown formatting
- Proper timestamp formats
- Valid Joplin API response structures
- Edge cases like missing fields
- Error response formats matching Joplin API

## Future Enhancements

### Additional Test Coverage
- Plugin lifecycle tests
- Memory leak detection
- Performance benchmarking
- Cross-browser compatibility
- Accessibility testing

### Test Automation
- Continuous integration setup
- Automated test reporting
- Coverage threshold enforcement
- Performance regression detection

### Mock Improvements
- More realistic Joplin server simulation
- Dynamic mock data generation
- Network condition simulation
- File system behavior mocking

## Troubleshooting

### Common Issues
1. **Obsidian Module Resolution**: Tests use mocked Obsidian API to avoid dependency issues
2. **Async Test Timing**: Tests use proper async/await patterns and timeouts
3. **Mock State Management**: Each test properly resets mock state

### Debug Tips
- Use `npm run test:ui` for interactive debugging
- Add `console.log` statements in test files for debugging
- Use `vi.spyOn` to monitor function calls
- Check mock function call counts and arguments

This comprehensive test suite ensures the Joplin Portal plugin is reliable, handles edge cases gracefully, and provides a good user experience across all supported scenarios.