# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.17] - 2025-08-30

### 📝 Other Changes

- More Submission Cleanup ([bc2d972])

### 👥 Contributors

- eristoddle

## [1.0.16] - 2025-08-29

### 🐛 Bug Fixes

- Fix Unit Tests ([9e46d91])
- Fix GA ([b6f2818])
- Fix Plugin Acceptance Issues ([cd9a443])

### 👥 Contributors

- eristoddle

## [1.0.15] - 2025-08-27

### 🐛 Bug Fixes

- Fix GA Release ([a9a3608])

### 👥 Contributors

- eristoddle

## [1.0.14] - 2025-08-27

### 📝 Other Changes

- Change Release Versions ([adb219f])

### 👥 Contributors

- eristoddle

## [1.0.13] - 2025-08-27

### ✨ New Features

- Add Screenshots ([48d90bf])

### 🐛 Bug Fixes

- fix(tests): handle async validation in settings tests ([2884560])
- Fix List Items in Readme ([41e11a0])

### 📝 Other Changes

- Merge remote-tracking branch 'origin/fix/unhandled-rejection-in-settings-test' ([aee87af])

### 👥 Contributors

- eristoddle
- google-labs-jules[bot]

## [1.0.12] - 2025-08-27

### 🐛 Bug Fixes

- fix(view): Remove incorrect call to private method ([4b3df7e])

### 👥 Contributors

- google-labs-jules[bot]

## [1.0.11] - 2025-08-26

### ✨ New Features

- feat(tests): Add tests for simplified icon registration ([2911cb5])

### 📝 Other Changes

- Finish Tasks with Jules ([e047a07])
- Refactor: Clean up icon registration logic ([38c5302])
- Icon Fix Plan ([f4d198f])

### 👥 Contributors

- eristoddle
- google-labs-jules[bot]

## [1.0.10] - 2025-08-24

### 🐛 Bug Fixes

- Fix Tests ([0a4a478])
- Fix Actions ([cc74271])
- Fix Icon Again ([65b08dc])

### 📝 Other Changes

- Who Knows If Fixes Actions ([6209cb5])

### 👥 Contributors

- eristoddle

## [1.0.9] - 2025-08-24

### 🐛 Bug Fixes

- Fix Actions ([3abd1ec])

### 👥 Contributors

- eristoddle

## [1.0.8] - 2025-08-24

### 🐛 Bug Fixes

- Fix Icon Issues ([d9e124a])
- Fix Some Icon Issues ([64e0cf7])

### 👥 Contributors

- eristoddle

## [1.0.7] - 2025-08-16

### ✨ New Features

- Add debug mode toggle to settings UI ([d72cf95])
- Add debug mode setting to plugin configuration ([e53a8b1])
- Add Plugin Cleanup Tasks ([8405e22])

### 🐛 Bug Fixes

- Fix Tests ([e17ab33])
- Fix Tests Again? ([13146fe])
- Fix Lint ([154f465])
- Integration testing of enhanced error handling ([2d2f0f7])
- Enhance error messages in import service ([208c010])
- Enhance error message specificity in API service ([64c0e8f])

### 📝 Other Changes

- Optional Frontmatter ([3ba4bf9])
- Final compliance validation and cleanup ([6827b6a])
- Create unit tests for URL validation ([9423c8b])
- Create unit tests for logging utility ([83d0c2f])
-  Integrate enhanced URL validation in settings ([7943b72])
- Implement enhanced URL validation ([ac17122])
- Replace console logging in remaining service files ([95c120f])
- Replace console logging in API service ([467a334])
- Replace console logging in main plugin file ([5cd609a])
- Create centralized logging utility ([3324991])
- Remove default hotkeys from command definitions ([4945fac])
- Remove Release Notes ([68d3768])

### 👥 Contributors

- eristoddle

## [1.0.6] - 2025-08-13

### ✨ New Features

- Add Asset Icon ([3a67d7b])

### 🐛 Bug Fixes

- Fix tests ([4840806])
- Fix Tests? ([8cbd2cd])
- Fix Lint ([163dac7])

### 📝 Other Changes

- Remove Node 20 Tests ([3467713])
- Lint Fix? ([e4d2593])

### 👥 Contributors

- eristoddle

## [1.0.5] - 2025-08-13

### 🚀 Improvements

- Update Manifest ([e2b2ab7])

### 📝 Other Changes

- Remove Unnecessary Files ([c74e631])
- Change to Desktop Only ([105325c])
- Replace Your Name and Your Username ([9fad981])

### 👥 Contributors

- eristoddle

## [1.0.4] - 2025-08-12

### 🐛 Bug Fixes

- Fix Release ([a994b35])

### 👥 Contributors

- eristoddle

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

*For detailed technical changes, see the [commit history](https://github.com/eristoddle/joplin-portal/commits/main).*