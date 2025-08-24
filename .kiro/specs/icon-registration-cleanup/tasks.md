# Implementation Plan

- [ ] 1. Import addIcon function and define icon constants
  - Add proper import statement for addIcon from 'obsidian' module
  - Define JOPLIN_ICON_ID and JOPLIN_ICON_SVG as constants at the top of the class
  - Remove any existing icon-related imports that are not needed
  - _Requirements: 1.2, 4.4_

- [ ] 2. Create clean icon registration function
  - Replace the existing registerJoplinIcon() function with a clean implementation
  - Use the standard addIcon() function with proper error handling
  - Remove all fallback methods and complex registration logic
  - Add appropriate logging for success and error cases
  - _Requirements: 1.1, 1.2, 2.4, 4.1, 4.2_

- [ ] 3. Remove duplicate and unnecessary icon functions
  - Delete the registerJoplinIconEarly() function completely
  - Delete the setupIconPersistenceCheck() function completely
  - Delete the debugIconStatus() function completely
  - Remove any icon persistence interval clearing code from onunload
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 4. Clean up onload method icon registration calls
  - Remove all multiple calls to registerJoplinIcon() throughout onload
  - Add single call to registerJoplinIcon() early in onload, before addRibbonIcon
  - Remove icon registration from workspace.onLayoutReady callback
  - Remove icon registration from layout-change event handler
  - _Requirements: 1.4, 4.3_

- [ ] 5. Remove icon-related debug commands
  - Delete the 'refresh-joplin-icon' command registration
  - Delete the 'debug-joplin-icon' command registration
  - Remove any command handlers related to icon debugging
  - _Requirements: 3.3_

- [ ] 6. Clean up event listeners and intervals
  - Remove icon-related event listeners from workspace events
  - Remove iconPersistenceInterval property and its usage
  - Clean up any icon-related cleanup code in onunload method
  - _Requirements: 3.4, 3.5_

- [ ] 7. Update and fix affected tests
  - Remove tests for deleted functions (registerJoplinIconEarly, setupIconPersistenceCheck, debugIconStatus)
  - Update existing tests to work with the simplified icon registration
  - Add basic test for the new registerJoplinIcon function
  - Ensure all integration tests still pass with the simplified implementation
  - _Requirements: 1.1, 2.1, 2.2, 2.3_

- [ ] 8. Verify build process and final cleanup
  - Run build process to ensure no compilation errors
  - Test that the plugin loads correctly with the new icon registration
  - Verify that the ribbon icon appears and functions correctly
  - Remove any unused imports or variables related to the old icon system
  - _Requirements: 2.1, 2.2, 2.3, 4.1_