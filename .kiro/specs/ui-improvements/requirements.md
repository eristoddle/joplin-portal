# Requirements Document

## Introduction

This specification covers targeted UI improvements to the Joplin Portal plugin to enhance user experience through cleaner interfaces, better space utilization, and removal of unnecessary visual clutter. These improvements focus on the Preview panel footer, Search Results layout, and Import functionality presentation.

## Requirements

### Requirement 1

**User Story:** As an Obsidian user viewing Joplin note previews, I want a simplified footer with only essential information displayed inline, so that I can quickly see the most important metadata without visual clutter.

#### Acceptance Criteria

1. WHEN viewing a note preview THEN the system SHALL display only Source and Updated information in the footer
2. WHEN displaying the Source information THEN the system SHALL make it a clickable hyperlink
3. WHEN displaying the Updated information THEN the system SHALL show only the date in a readable format (e.g., "7/14/2025")
4. WHEN rendering the footer THEN the system SHALL display Source and Updated information inline with format "Source(hyperlinked) - Updated: 7/14/2025"
5. WHEN the footer is displayed THEN the system SHALL NOT show created date, ID, or word count information
6. WHEN the Source link is clicked THEN the system SHALL navigate to the original Joplin note if applicable

### Requirement 2

**User Story:** As an Obsidian user viewing search results in a narrow drawer, I want checkboxes positioned inline with result titles, so that I can efficiently select notes without wasted screen space.

#### Acceptance Criteria

1. WHEN search results are displayed in a narrow drawer THEN the system SHALL position checkboxes inline with the result title
2. WHEN the drawer width is constrained THEN the system SHALL NOT place checkboxes on separate rows
3. WHEN displaying search results THEN the system SHALL optimize horizontal space usage by keeping checkboxes and titles on the same line
4. WHEN the checkbox is inline THEN the system SHALL maintain proper spacing and alignment with the result title
5. WHEN the drawer is resized THEN the system SHALL maintain the inline checkbox layout regardless of width

### Requirement 3

**User Story:** As an Obsidian user performing searches, I want a clean search interface without technical performance metrics, so that I can focus on finding relevant content without distraction.

#### Acceptance Criteria

1. WHEN displaying search results THEN the system SHALL NOT show cache hit rate information
2. WHEN search operations complete THEN the system SHALL NOT display performance metrics or technical statistics
3. WHEN the search interface is rendered THEN the system SHALL focus on search functionality and results without exposing internal performance data
4. WHEN users interact with search THEN the system SHALL provide only user-relevant feedback about search status and results

### Requirement 4

**User Story:** As an Obsidian user selecting notes for import, I want the import button to show the count inline without separate status messages, so that I have a cleaner interface with essential information integrated into the action button.

#### Acceptance Criteria

1. WHEN notes are selected for import THEN the system SHALL display the count in parentheses within the import button text
2. WHEN displaying the import button THEN the system SHALL use format "(X) Import Selected" where X is the number of selected notes
3. WHEN notes are selected THEN the system SHALL NOT display separate "X note(s) selected for import" messages
4. WHEN no notes are selected THEN the system SHALL display "Import Selected" without parentheses
5. WHEN the selection count changes THEN the system SHALL update the button text immediately to reflect the new count
6. WHEN the import button is displayed THEN the system SHALL maintain consistent styling while incorporating the count information