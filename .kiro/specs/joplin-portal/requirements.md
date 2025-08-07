# Requirements Document

## Introduction

The Joplin Portal plugin enables Obsidian users to access, search, and import notes from their Joplin server without cluttering their Obsidian vault. The plugin provides a seamless bridge between Joplin's comprehensive note storage and Obsidian's powerful writing environment, allowing users to reference and selectively import Joplin content while maintaining their preferred Obsidian workflow.

## Requirements

### Requirement 1

**User Story:** As an Obsidian user with existing Joplin notes, I want to configure my Joplin server connection, so that I can access my Joplin notes from within Obsidian.

#### Acceptance Criteria

1. WHEN the user opens the plugin settings THEN the system SHALL provide fields for Joplin server URL and API token
2. WHEN the user enters valid Joplin server credentials THEN the system SHALL verify the connection and store the configuration
3. IF the connection fails THEN the system SHALL display a clear error message with troubleshooting guidance
4. WHEN the user saves valid configuration THEN the system SHALL enable all plugin functionality

### Requirement 2

**User Story:** As an Obsidian user, I want to search my Joplin notes from a dedicated panel, so that I can reference my existing notes while writing without leaving Obsidian.

#### Acceptance Criteria

1. WHEN the user opens the Joplin Portal panel THEN the system SHALL display a search interface
2. WHEN the user enters a search query THEN the system SHALL perform full-text search against the Joplin API
3. WHEN search results are returned THEN the system SHALL display note titles, snippets, and metadata in a readable list
4. WHEN the user clicks on a search result THEN the system SHALL display the full note content in a preview pane
5. IF the Joplin API supports tag search THEN the system SHALL provide tag-based filtering options
6. WHEN no results are found THEN the system SHALL display an appropriate "no results" message

### Requirement 3

**User Story:** As an Obsidian user, I want to selectively import Joplin notes into my Obsidian vault, so that I can convert relevant content while maintaining my vault organization.

#### Acceptance Criteria

1. WHEN viewing search results THEN the system SHALL provide checkboxes for each note to mark for import
2. WHEN the user selects notes for import THEN the system SHALL provide options for target folder and template application
3. WHEN the user confirms import THEN the system SHALL convert Joplin notes to Obsidian-compatible markdown format
4. WHEN importing notes THEN the system SHALL preserve note content, titles, and creation dates
5. IF the target folder doesn't exist THEN the system SHALL create it automatically
6. WHEN import is complete THEN the system SHALL provide feedback on successful imports and any errors
7. IF a note with the same name already exists THEN the system SHALL prompt the user for conflict resolution

### Requirement 4

**User Story:** As an Obsidian user, I want the plugin to handle Joplin API limitations gracefully, so that I have a reliable experience even when the API has constraints.

#### Acceptance Criteria

1. WHEN the Joplin API is unavailable THEN the system SHALL display an appropriate offline message
2. WHEN API requests timeout THEN the system SHALL retry with exponential backoff
3. WHEN API rate limits are encountered THEN the system SHALL queue requests and inform the user
4. WHEN the API returns errors THEN the system SHALL log detailed error information for troubleshooting
5. WHEN search queries exceed API limitations THEN the system SHALL provide guidance on refining the search

### Requirement 5

**User Story:** As an Obsidian user, I want the plugin interface to integrate seamlessly with Obsidian's UI, so that it feels like a native part of my workflow.

#### Acceptance Criteria

1. WHEN the plugin is activated THEN the system SHALL add a Joplin Portal panel to the sidebar
2. WHEN the user interacts with the panel THEN the system SHALL follow Obsidian's UI patterns and styling
3. WHEN displaying search results THEN the system SHALL use consistent typography and spacing with Obsidian
4. WHEN the user resizes the panel THEN the system SHALL maintain proper layout and readability
5. WHEN the plugin loads THEN the system SHALL not interfere with Obsidian's startup performance

### Requirement 6

**User Story:** As an Obsidian user, I want to see images from Joplin notes rendered properly in both the search preview and dedicated note view, so that I can fully evaluate note content before importing.

#### Acceptance Criteria

1. WHEN a Joplin note contains image resources with proprietary links (:/resource_id format) THEN the system SHALL convert them to displayable images
2. WHEN displaying note preview in the search modal THEN the system SHALL render all images inline using base64 data URIs
3. WHEN opening a note in the dedicated view THEN the system SHALL render all images inline using base64 data URIs
4. WHEN processing image resources THEN the system SHALL fetch the resource metadata to determine the correct MIME type
5. WHEN processing image resources THEN the system SHALL fetch the raw image data and convert it to base64 format
6. WHEN an image resource cannot be loaded THEN the system SHALL display a placeholder or error message instead of broken links
7. WHEN processing notes with multiple images THEN the system SHALL handle all images efficiently without blocking the UI

### Requirement 7

**User Story:** As an Obsidian user, I want imported Joplin notes to have their images properly stored in my Obsidian vault, so that the images remain accessible even when disconnected from Joplin.

#### Acceptance Criteria

1. WHEN importing a note with image resources THEN the system SHALL download all image files from Joplin
2. WHEN downloading image files THEN the system SHALL store them in Obsidian's global attachments folder
3. WHEN storing image files THEN the system SHALL use appropriate filenames based on the original resource metadata
4. WHEN storing image files THEN the system SHALL handle filename conflicts by appending numbers or timestamps
5. WHEN converting note content for import THEN the system SHALL replace Joplin resource links with standard Obsidian attachment links
6. WHEN import is complete THEN the imported note SHALL reference local image files instead of Joplin resources
7. IF image download fails during import THEN the system SHALL log the error and preserve the original link with a warning comment

### Requirement 8

**User Story:** As an Obsidian user, I want Joplin notes containing HTML image tags with joplin-id URLs to render properly in both preview and import, so that I can see all images regardless of their original format in Joplin.

#### Acceptance Criteria

1. WHEN a Joplin note contains HTML img tags with joplin-id: URLs (e.g., `<img src="joplin-id:resource_id"/>`) THEN the system SHALL detect and process these images
2. WHEN processing HTML img tags with joplin-id URLs THEN the system SHALL extract the resource ID from the joplin-id: prefix
3. WHEN displaying note preview THEN the system SHALL convert HTML img tags with joplin-id URLs to base64 data URIs for rendering
4. WHEN importing notes THEN the system SHALL convert HTML img tags with joplin-id URLs to standard Obsidian attachment links
5. WHEN processing HTML img tags THEN the system SHALL preserve any existing attributes like width, height, alt text, and CSS classes
6. WHEN an HTML img tag with joplin-id URL cannot be processed THEN the system SHALL display a placeholder with the original attributes preserved
7. WHEN both markdown and HTML image formats exist in the same note THEN the system SHALL process both formats correctly