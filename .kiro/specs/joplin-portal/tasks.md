# Implementation Plan

- [x] 1. Set up project structure and core interfaces
  - Create Obsidian plugin boilerplate with TypeScript configuration
  - Define core TypeScript interfaces for JoplinNote, SearchResult, and Settings
  - Set up project dependencies and build configuration
  - _Requirements: 1.1, 5.1_

- [x] 2. Implement settings management and configuration
  - Create JoplinPortalSettings interface and default values
  - Implement JoplinPortalSettingTab class extending PluginSettingTab
  - Add settings UI with server URL and API token fields
  - Implement settings persistence using Obsidian's data storage
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Create Joplin API service foundation
  - Implement JoplinApiService class with HTTP client setup
  - Add authentication handling with API token
  - Create connection testing method with ping endpoint
  - Implement basic error handling and logging
  - _Requirements: 1.2, 1.3, 4.1, 4.4_

- [x] 4. Implement search functionality
  - Add searchNotes method to JoplinApiService using /search endpoint
  - Implement query parameter handling and field selection
  - Add pagination support for large result sets
  - Create data transformation from Joplin API response to SearchResult objects
  - _Requirements: 2.2, 2.6, 4.3_

- [x] 5. Create sidebar panel view
  - Implement JoplinPortalView class extending ItemView
  - Create search interface with input field and search button
  - Add results container for displaying search results
  - Implement view registration in main plugin class
  - _Requirements: 2.1, 5.1, 5.2_

- [x] 6. Build search results display
  - Create HTML structure for search results list
  - Implement result item rendering with title, snippet, and metadata
  - Add click handlers for result selection and preview
  - Style results list to match Obsidian's UI patterns
  - _Requirements: 2.3, 5.3, 5.4_

- [x] 7. Implement note preview functionality
  - Add preview pane to the sidebar view
  - Create getNote method in JoplinApiService for full note retrieval
  - Implement note content rendering in preview pane
  - Add loading states and error handling for preview
  - _Requirements: 2.4, 4.1_

- [x] 8. Add import selection interface
  - Create checkboxes for each search result to mark for import
  - Implement multi-select functionality for batch imports
  - Add import options panel with folder selection and template options
  - Create import confirmation dialog
  - _Requirements: 3.1, 3.2_

- [x] 9. Implement note import functionality
  - Create markdown conversion utility for Joplin to Obsidian format
  - Implement file creation in target Obsidian folder
  - Add automatic folder creation when target doesn't exist
  - Preserve note metadata (title, creation date) during import
  - _Requirements: 3.3, 3.4, 3.5_

- [x] 10. Add import conflict resolution
  - Detect existing files with same names during import
  - Implement conflict resolution dialog with skip/overwrite/rename options
  - Add automatic file renaming logic for conflicts
  - Provide user feedback on import results and conflicts
  - _Requirements: 3.7, 3.6_

- [x] 11. Implement error handling and resilience
  - Add retry logic with exponential backoff for API requests
  - Implement offline detection and appropriate user messaging
  - Add rate limiting protection and request queuing
  - Create comprehensive error logging and user-friendly error messages
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 12. Add search enhancements and optimizations
  - Implement search input debouncing to prevent excessive API calls
  - Add tag-based search functionality if supported by Joplin API
  - Create search result caching for improved performance
  - Add search query validation and API limitation handling
  - _Requirements: 2.5, 4.5_

- [x] 13. Implement main plugin class and lifecycle
  - Create JoplinPortalPlugin class extending Obsidian's Plugin
  - Implement onload method with view registration and service initialization
  - Add onunload method for proper cleanup
  - Integrate settings loading and saving in plugin lifecycle
  - _Requirements: 1.4, 5.1, 5.5_

- [x] 14. Add connection validation to settings
  - Implement connection test button in settings tab
  - Add real-time validation feedback for server URL and token
  - Create troubleshooting guidance for connection failures
  - Add settings validation before enabling plugin functionality
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 15. Create comprehensive test suite
  - Write unit tests for JoplinApiService methods
  - Create tests for markdown conversion and import functionality
  - Add integration tests for search and import workflows
  - Implement mock Joplin API responses for testing
  - _Requirements: All requirements - testing coverage_

- [x] 16. Polish UI and user experience
  - Ensure consistent styling with Obsidian's theme system
  - Add loading indicators and progress feedback
  - Implement proper responsive layout for panel resizing
  - Add keyboard shortcuts and accessibility features
  - _Requirements: 5.2, 5.3, 5.4, 5.5_

- [x] 17. Create release automation scripts
  - Create version bump script to update manifest.json and package.json versions
  - Add build script for production release (minification, optimization)
  - Create release preparation script to generate required plugin files
  - Add changelog generation script for release notes
  - _Requirements: Distribution and maintenance_

- [x] 18. Set up GitHub Actions CI/CD pipeline
  - Create workflow for automated testing on pull requests
  - Add workflow for building and validating plugin on commits
  - Implement automated release workflow triggered by version tags
  - Add workflow to automatically create GitHub releases with plugin assets
  - _Requirements: Automated deployment and quality assurance_

- [x] 19. Prepare for community plugin submission
  - Create comprehensive README with installation and usage instructions
  - Add plugin metadata and description for Obsidian community directory
  - Create plugin icon and banner assets
  - Prepare submission materials for Obsidian community plugin review
  - _Requirements: Community distribution and user onboarding_

- [x] 20. Implement image resource processing in Joplin API service
  - Add getResourceMetadata method to fetch resource information including MIME type
  - Implement getResourceFile method to fetch raw binary data as ArrayBuffer
  - Create processNoteBodyForImages method to convert Joplin resource links to base64 data URIs
  - Add proper error handling for missing resources and network failures
  - _Requirements: 6.1, 6.4, 6.5, 6.6_

- [x] 21. Integrate image processing in search preview
  - Modify JoplinPortalView's showPreview method to process images before rendering
  - Update renderNoteContent to call processNoteBodyForImages before MarkdownRenderer
  - Add loading states and error handling for image processing
  - Ensure images render properly in the preview pane
  - _Requirements: 6.2, 6.7_

- [x] 22. Add comprehensive error handling for image processing
  - Implement placeholder display for missing or failed image resources
  - Add retry logic for failed image downloads with exponential backoff
  - Handle non-image resources gracefully by preserving original links
  - Add logging for image processing failures for debugging
  - _Requirements: 6.6, 6.7_

- [x] 23. Optimize image processing performance
  - Implement caching for processed images to avoid repeated API calls
  - Add concurrent processing for multiple images in a single note
  - Consider image size limits and compression for large images
  - Add progress indicators for notes with many images
  - _Requirements: 6.7_

- [x] 24. Implement image download and storage for import functionality
  - Create downloadAndStoreImages method in import service to handle image downloads
  - Implement generateUniqueFilename method to handle filename conflicts
  - Add logic to determine Obsidian's attachments folder configuration
  - Create file system operations to save downloaded images locally
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 25. Update note import process to handle images
  - Modify import workflow to process images before saving notes
  - Replace Joplin resource links with local file references during import
  - Add progress indicators for image downloads during import
  - Implement error handling for failed image downloads with fallback options
  - _Requirements: 7.5, 7.6, 7.7_

- [x] 26. Test image rendering and import functionality
  - Create unit tests for image processing methods (both preview and import)
  - Test with various image formats (PNG, JPEG, GIF, WebP)
  - Test error scenarios (missing resources, network failures, invalid MIME types)
  - Verify images render correctly in both search preview and dedicated view
  - Test complete import workflow with image download and local storage
  - _Requirements: 6.1, 6.2, 6.3, 6.6, 7.1, 7.2, 7.6_

- [x] 27. Implement HTML image detection and processing in Joplin API service
  - Add regex pattern to detect HTML img tags with joplin-id: URLs in processNoteBodyForImages method
  - Create extractHtmlImageAttributes method to parse and preserve HTML attributes (width, height, alt, class, style)
  - Implement processHtmlImageTag method to extract resource ID from joplin-id: URL format
  - Update processNoteBodyForImages to handle both markdown and HTML image formats in the same note
  - _Requirements: 8.1, 8.2, 8.5_

- [x] 28. Add HTML image replacement logic with attribute preservation
  - Create reconstructHtmlImageTag method to rebuild img tag with data URI while preserving attributes
  - Implement proper HTML attribute parsing to handle various quote styles and attribute orders
  - Add validation for resource ID format extracted from joplin-id: URLs
  - Update error handling to create HTML placeholders for failed HTML images
  - _Requirements: 8.3, 8.5, 8.6_

- [x] 29. Update import service to handle HTML images during note import
  - Modify downloadAndStoreImages method to detect and process HTML img tags with joplin-id: URLs
  - Update replaceResourceLinksWithLocal method to handle HTML image format conversion
  - Ensure HTML img tags are converted to local file references while preserving attributes
  - Add comprehensive logging for HTML image processing during import
  - _Requirements: 8.4, 8.7_

- [x] 30. Test HTML image processing functionality
  - Create unit tests for HTML image detection regex and attribute parsing
  - Test HTML image processing with various attribute combinations (width, height, alt, class, style)
  - Test mixed content notes containing both markdown and HTML images
  - Verify HTML images render correctly in preview and convert properly during import
  - Test error scenarios with malformed HTML img tags and invalid joplin-id URLs
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 31. Clean up ineffective image processing code and implement proper solution
  - Remove complex base64 conversion methods that don't work properly
  - Remove image cache, compression, and HTML processing utilities that are unnecessary
  - Implement simple URL replacement for preview panel using Joplin API URLs
  - Implement proper image download for import functionality to Obsidian attachments folder
  - Clean up related test files that test the removed functionality
  - _Requirements: 6.1, 6.2, 7.1, 7.2_

- [x] 32. Fix tag search functionality to return accurate results
  - Investigate current tag search implementation in JoplinApiService.searchNotesByTags method
  - Review Joplin API documentation for correct tag search syntax using "tag:" prefix
  - Update tag search query construction to use proper format: "tag:tagname" for each tag
  - Test tag search with known tags to verify all matching notes are returned
  - Add logging to debug tag search API requests and responses
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 33. Remove combined search functionality and simplify search interface
  - Remove "Combined" option from search type selector in JoplinPortalView
  - Update search interface to only show "Text Search" and "Tag Search" options
  - Remove combined search logic from performSearch method
  - Update search interface styling and layout for simplified two-option design
  - Update help text and accessibility labels to reflect simplified interface
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 34. Add source URL to note frontmatter during import
  - Update ImportService.generateFrontmatter method to include source URL field
  - Modify frontmatter generation to add "source: [URL]" when source_url is available
  - Ensure source URL field is properly formatted and escaped in YAML frontmatter
  - Test import functionality with notes that have source URLs
  - Verify imported notes display source URL correctly in Obsidian frontmatter
  - _Requirements: 3.4, 3.5_

- [x] 35. Test and validate all fixes
  - Test tag search with various tags to ensure all matching notes are returned
  - Verify search interface only shows Text Search and Tag Search options
  - Test note import to confirm source URLs appear in frontmatter
  - Validate that image processing still works correctly for both preview and import
  - Run existing test suite to ensure no regressions were introduced
  - _Requirements: 9.1, 9.2, 9.3, 10.1, 10.2, 3.5_

- [x] 36. Remove intrusive tooltips from search results and preview
  - Audit all tooltip implementations in JoplinPortalView to identify random/intrusive ones
  - Remove or disable tooltips that appear during scrolling or content viewing
  - Implement TooltipManager class to control when tooltips should appear
  - Update search result rendering to minimize tooltip usage
  - Test scrolling through search results to ensure no random tooltips appear
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 37. Implement essential-only tooltip strategy
  - Create shouldShowTooltip method to determine if a tooltip is necessary
  - Add quick auto-hide functionality for any remaining essential tooltips
  - Ensure tooltips only appear on intentional user interaction (not hover during scrolling)
  - Update tooltip styling to be less intrusive when they do appear
  - Test tooltip behavior to ensure they don't interfere with note reading
  - _Requirements: 11.5_

- [x] 38. Redesign drawer interface to show only Import Selected button
  - Remove all extra fields and configuration options from the main drawer interface
  - Keep only the search results list and "Import Selected" button visible in drawer
  - Update drawer layout and styling to maximize space for search results
  - Ensure Import Selected button is prominently displayed and easily accessible
  - Test drawer interface at different sizes to ensure optimal space usage
  - _Requirements: 12.1, 12.4_

- [x] 39. Create import options modal for secondary functionality
  - Implement ImportOptionsModal class with clean, focused interface design
  - Move target folder selection, template options, and conflict resolution to modal
  - Add advanced settings section within the modal for additional configuration
  - Create modal trigger from Import Selected button click
  - Implement proper modal show/hide functionality with keyboard support
  - _Requirements: 12.2, 12.3_

- [x] 40. Integrate modal workflow with import process
  - Update import workflow to open modal when Import Selected is clicked
  - Implement getImportOptions method to collect all configuration from modal
  - Add execute import functionality within the modal with progress feedback
  - Ensure modal provides clear primary/secondary action buttons
  - Test complete import workflow from drawer button through modal to completion
  - _Requirements: 12.5_

- [x] 41. Audit and fix failing unit tests
  - Run complete test suite to identify all failing tests
  - Categorize test failures by type (missing imports, outdated assertions, deprecated APIs, broken mocks)
  - Create TestAuditResult for each failing test with specific issues and recommendations
  - Document which tests reference code that no longer exists
  - Prioritize test fixes based on current functionality relevance
  - _Requirements: 13.1, 13.2, 13.4_

- [ ] 42. Remove obsolete tests and update outdated assertions
  - Remove unit tests that reference deleted functionality or non-existent code
  - Update test assertions that use outdated expected values or API responses
  - Fix tests with incorrect file path assumptions or missing imports
  - Update mock data structures to match current interfaces and API responses
  - Ensure all remaining tests align with current plugin functionality
  - _Requirements: 13.5, 13.6_

- [ ] 43. Validate test suite and CI/CD pipeline
  - Run complete test suite to ensure all tests pass locally
  - Verify GitHub Actions workflow runs successfully with updated tests
  - Test CI/CD pipeline by pushing changes and monitoring action results
  - Fix any remaining test environment issues or configuration problems
  - Ensure test coverage remains meaningful for current codebase
  - _Requirements: 13.3_