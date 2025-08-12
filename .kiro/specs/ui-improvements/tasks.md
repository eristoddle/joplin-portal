# Implementation Plan

- [x] 1. Simplify preview panel footer to show only Source and Updated information inline
  - Modify the `renderNoteMetadata()` method in `src/joplin-portal-view.ts` to create simplified metadata display
  - Replace the current grid layout with inline text format "Source(hyperlinked) - Updated: MM/DD/YYYY"
  - Remove created date, ID, and word count from the footer display
  - Ensure source URL remains clickable and accessible
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 2. Position checkboxes inline with result titles to optimize space usage
  - Update the result item structure in the `displayResults()` method in `src/joplin-portal-view.ts`
  - Modify CSS for `.joplin-result-item` to maintain flex row layout at all widths
  - Adjust `.joplin-result-checkbox` positioning to stay inline with titles
  - Update responsive breakpoints and container queries to prevent checkbox wrapping
  - Test layout behavior in narrow drawer widths to ensure proper alignment
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 3. Remove cache hit rate details from search interface
  - Remove or comment out cache status display logic in the `updateCacheStatus()` method
  - Remove the `.joplin-cache-status` element from the search interface creation
  - Update CSS to hide or remove `.joplin-cache-status` styles
  - Adjust search container spacing to account for removed element
  - Ensure underlying cache functionality remains intact for performance
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 4. Integrate import count into button text instead of separate message
  - Modify the `updateImportSelectionCount()` method in `src/joplin-portal-view.ts`
  - Update import button text to format "(X) Import Selected" where X is the selection count
  - Show "Import Selected" without parentheses when no notes are selected
  - Remove or hide the separate "X notes selected for import" message display
  - Update button CSS to accommodate variable text length while maintaining consistent appearance
  - Test button behavior with different selection counts (0, 1, multiple)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_