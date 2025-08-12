# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2025-08-12

### 🚀 Improvements

- Update Release ([a9137b4])

### 👥 Contributors

- eristoddle

## [1.0.2] - 2025-08-12

### 🚀 Improvements

- Update Release Script ([6fe6757])

### 👥 Contributors

- eristoddle

## [1.0.0] - 2024-01-XX

### Added
- Initial release of Joplin Portal plugin
- Joplin server connection configuration with API token authentication
- Real-time search functionality across all Joplin notes
- Live preview of note content in sidebar panel
- Selective note import with batch operations
- Conflict resolution for duplicate note names (skip, overwrite, rename)
- Markdown format conversion from Joplin to Obsidian
- Search result caching for improved performance
- Debounced search input to prevent excessive API calls
- Retry logic with exponential backoff for API requests
- Comprehensive error handling and user-friendly error messages
- Settings validation with connection testing
- Responsive UI that adapts to Obsidian themes
- Full test suite with unit and integration tests
- Automated release pipeline with GitHub Actions

### Features
- **Search & Discovery**
  - Full-text search across all Joplin notes
  - Tag-based search filtering
  - Search result snippets with highlighting
  - Pagination support for large result sets

- **Note Preview**
  - Live preview pane in sidebar
  - Formatted markdown rendering
  - Metadata display (creation date, tags)

- **Import System**
  - Multi-select note import
  - Configurable target folder selection
  - Automatic folder creation
  - Conflict resolution options
  - Import progress feedback

- **Configuration**
  - Secure API token storage
  - Connection validation
  - Customizable search limits
  - Default import folder settings

- **Performance & Reliability**
  - Search result caching
  - Request debouncing
  - Automatic retry on failures
  - Offline detection
  - Rate limiting protection

### Technical Details
- Built with TypeScript for type safety
- Comprehensive test coverage (unit + integration)
- Follows Obsidian plugin development best practices
- Modular architecture with service layers
- Secure API communication with proper error handling

### Requirements
- Obsidian v0.15.0 or higher
- Joplin desktop app with Web Clipper enabled, or Joplin Server
- Valid Joplin API token

---

## Future Releases

### Planned Features
- Export notes from Obsidian to Joplin
- Advanced search filters and sorting options
- Custom import templates
- Bulk operations for note management
- Synchronization status indicators
- Plugin API for extensibility

---

*For detailed technical changes, see the [commit history](https://github.com/your-username/joplin-portal/commits/main).*