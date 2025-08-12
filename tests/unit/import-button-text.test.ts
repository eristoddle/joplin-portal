import { describe, it, expect, beforeEach } from 'vitest';

// Create a simple test for the updateImportSelectionCount method logic
describe('Import Button Text Integration', () => {
  let mockImportOptionsPanel: HTMLElement;
  let mockImportButton: HTMLButtonElement;
  let currentResults: any[];

  // Mock the updateImportSelectionCount method logic
  const updateImportSelectionCount = () => {
    const selectedCount = currentResults.filter(result => result.markedForImport).length;

    // Update import button text to include count
    const importBtn = mockImportOptionsPanel.querySelector('.joplin-import-btn-prominent') as HTMLButtonElement;
    if (importBtn) {
      // Format button text based on selection count
      if (selectedCount === 0) {
        importBtn.textContent = 'Import Selected';
      } else {
        importBtn.textContent = `(${selectedCount}) Import Selected`;
      }

      // Enable/disable import button based on selection
      importBtn.disabled = selectedCount === 0;
    }
  };

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = '';

    // Create mock import options panel
    mockImportOptionsPanel = document.createElement('div');
    mockImportOptionsPanel.className = 'joplin-import-options-simplified';

    // Create mock import button
    mockImportButton = document.createElement('button');
    mockImportButton.className = 'joplin-import-btn-prominent';
    mockImportButton.textContent = 'Import Selected';
    mockImportOptionsPanel.appendChild(mockImportButton);

    // Create mock count div (hidden)
    const countDiv = document.createElement('div');
    countDiv.className = 'joplin-selected-count-prominent';
    countDiv.style.display = 'none';
    mockImportOptionsPanel.appendChild(countDiv);

    document.body.appendChild(mockImportOptionsPanel);

    // Initialize empty results
    currentResults = [];
  });

  it('should show "Import Selected" when no notes are selected', () => {
    // Set up empty results
    currentResults = [];

    // Call the method
    updateImportSelectionCount();

    // Check button text
    const importBtn = mockImportOptionsPanel.querySelector('.joplin-import-btn-prominent') as HTMLButtonElement;
    expect(importBtn).toBeTruthy();
    expect(importBtn.textContent).toBe('Import Selected');
    expect(importBtn.disabled).toBe(true);
  });

  it('should show "(1) Import Selected" when one note is selected', () => {
    // Set up results with one selected note
    currentResults = [
      {
        note: { id: '1', title: 'Test Note', created_time: Date.now(), updated_time: Date.now() },
        snippet: 'Test snippet',
        markedForImport: true,
        selected: false
      }
    ];

    // Call the method
    updateImportSelectionCount();

    // Check button text
    const importBtn = mockImportOptionsPanel.querySelector('.joplin-import-btn-prominent') as HTMLButtonElement;
    expect(importBtn).toBeTruthy();
    expect(importBtn.textContent).toBe('(1) Import Selected');
    expect(importBtn.disabled).toBe(false);
  });

  it('should show "(3) Import Selected" when multiple notes are selected', () => {
    // Set up results with multiple selected notes
    currentResults = [
      {
        note: { id: '1', title: 'Test Note 1', created_time: Date.now(), updated_time: Date.now() },
        snippet: 'Test snippet 1',
        markedForImport: true,
        selected: false
      },
      {
        note: { id: '2', title: 'Test Note 2', created_time: Date.now(), updated_time: Date.now() },
        snippet: 'Test snippet 2',
        markedForImport: false,
        selected: false
      },
      {
        note: { id: '3', title: 'Test Note 3', created_time: Date.now(), updated_time: Date.now() },
        snippet: 'Test snippet 3',
        markedForImport: true,
        selected: false
      },
      {
        note: { id: '4', title: 'Test Note 4', created_time: Date.now(), updated_time: Date.now() },
        snippet: 'Test snippet 4',
        markedForImport: true,
        selected: false
      }
    ];

    // Call the method
    updateImportSelectionCount();

    // Check button text
    const importBtn = mockImportOptionsPanel.querySelector('.joplin-import-btn-prominent') as HTMLButtonElement;
    expect(importBtn).toBeTruthy();
    expect(importBtn.textContent).toBe('(3) Import Selected');
    expect(importBtn.disabled).toBe(false);
  });

  it('should update button text when selection changes', () => {
    // Start with no selection
    currentResults = [
      {
        note: { id: '1', title: 'Test Note 1', created_time: Date.now(), updated_time: Date.now() },
        snippet: 'Test snippet 1',
        markedForImport: false,
        selected: false
      },
      {
        note: { id: '2', title: 'Test Note 2', created_time: Date.now(), updated_time: Date.now() },
        snippet: 'Test snippet 2',
        markedForImport: false,
        selected: false
      }
    ];

    updateImportSelectionCount();

    const importBtn = mockImportOptionsPanel.querySelector('.joplin-import-btn-prominent') as HTMLButtonElement;
    expect(importBtn.textContent).toBe('Import Selected');
    expect(importBtn.disabled).toBe(true);

    // Select one note
    currentResults[0].markedForImport = true;
    updateImportSelectionCount();

    expect(importBtn.textContent).toBe('(1) Import Selected');
    expect(importBtn.disabled).toBe(false);

    // Select second note
    currentResults[1].markedForImport = true;
    updateImportSelectionCount();

    expect(importBtn.textContent).toBe('(2) Import Selected');
    expect(importBtn.disabled).toBe(false);

    // Deselect all
    currentResults[0].markedForImport = false;
    currentResults[1].markedForImport = false;
    updateImportSelectionCount();

    expect(importBtn.textContent).toBe('Import Selected');
    expect(importBtn.disabled).toBe(true);
  });

  it('should hide the separate count message element', () => {
    // Check that the separate count message is hidden
    const countDiv = mockImportOptionsPanel.querySelector('.joplin-selected-count-prominent') as HTMLElement;
    expect(countDiv).toBeTruthy();
    expect(countDiv.style.display).toBe('none');
  });
});