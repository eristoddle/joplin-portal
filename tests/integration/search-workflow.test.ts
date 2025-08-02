import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JoplinPortalView } from '../../src/joplin-portal-view';
import { JoplinApiService } from '../../src/joplin-api-service';
import { mockJoplinNotes, mockSearchResponse } from '../mocks/joplin-api-mocks';

vi.mock('obsidian');
vi.mock('../../src/joplin-api-service');

describe('Search Workflow Integration', () => {
  let view: JoplinPortalView;
  let mockPlugin: any;
  let mockJoplinService: any;
  let mockContainerEl: HTMLElement;

  beforeEach(() => {
    mockContainerEl = document.createElement('div');

    mockJoplinService = {
      searchNotes: vi.fn(),
      getNote: vi.fn(),
      testConnection: vi.fn()
    };

    mockPlugin = {
      settings: {
        serverUrl: 'http://localhost:41184',
        apiToken: 'test-token',
        searchLimit: 50
      },
      joplinService: mockJoplinService
    };

    view = new JoplinPortalView(mockPlugin);
    view.containerEl = mockContainerEl;

    vi.clearAllMocks();
  });

  describe('complete search workflow', () => {
    it('should perform search and display results', async () => {
      mockJoplinService.searchNotes.mockResolvedValue(mockJoplinNotes);

      await view.onOpen();

      // Simulate user entering search query
      const searchInput = mockContainerEl.querySelector('input[type="text"]') as HTMLInputElement;
      const searchButton = mockContainerEl.querySelector('button') as HTMLButtonElement;

      searchInput.value = 'test query';
      searchButton.click();

      // Wait for search to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockJoplinService.searchNotes).toHaveBeenCalledWith('test query', {
        limit: 50
      });

      // Check that results are displayed
      const resultItems = mockContainerEl.querySelectorAll('.search-result-item');
      expect(resultItems.length).toBe(3);
    });

    it('should handle empty search results', async () => {
      mockJoplinService.searchNotes.mockResolvedValue([]);

      await view.onOpen();

      const searchInput = mockContainerEl.querySelector('input[type="text"]') as HTMLInputElement;
      const searchButton = mockContainerEl.querySelector('button') as HTMLButtonElement;

      searchInput.value = 'nonexistent';
      searchButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      const noResultsMessage = mockContainerEl.querySelector('.no-results');
      expect(noResultsMessage).toBeTruthy();
      expect(noResultsMessage?.textContent).toContain('No results found');
    });

    it('should debounce search input', async () => {
      mockJoplinService.searchNotes.mockResolvedValue(mockJoplinNotes);

      await view.onOpen();

      const searchInput = mockContainerEl.querySelector('input[type="text"]') as HTMLInputElement;

      // Simulate rapid typing
      searchInput.value = 't';
      searchInput.dispatchEvent(new Event('input'));

      searchInput.value = 'te';
      searchInput.dispatchEvent(new Event('input'));

      searchInput.value = 'test';
      searchInput.dispatchEvent(new Event('input'));

      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should only search once after debounce
      expect(mockJoplinService.searchNotes).toHaveBeenCalledTimes(1);
      expect(mockJoplinService.searchNotes).toHaveBeenCalledWith('test', { limit: 50 });
    });

    it('should handle search errors gracefully', async () => {
      mockJoplinService.searchNotes.mockRejectedValue(new Error('API Error'));

      await view.onOpen();

      const searchInput = mockContainerEl.querySelector('input[type="text"]') as HTMLInputElement;
      const searchButton = mockContainerEl.querySelector('button') as HTMLButtonElement;

      searchInput.value = 'test';
      searchButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      const errorMessage = mockContainerEl.querySelector('.error-message');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.textContent).toContain('Search failed');
    });
  });

  describe('note preview workflow', () => {
    beforeEach(async () => {
      mockJoplinService.searchNotes.mockResolvedValue(mockJoplinNotes);
      await view.onOpen();

      // Perform initial search
      const searchInput = mockContainerEl.querySelector('input[type="text"]') as HTMLInputElement;
      const searchButton = mockContainerEl.querySelector('button') as HTMLButtonElement;

      searchInput.value = 'test';
      searchButton.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should preview note when result is clicked', async () => {
      mockJoplinService.getNote.mockResolvedValue(mockJoplinNotes[0]);

      const firstResult = mockContainerEl.querySelector('.search-result-item') as HTMLElement;
      firstResult.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockJoplinService.getNote).toHaveBeenCalledWith('test-note-1');

      const previewPane = mockContainerEl.querySelector('.preview-pane');
      expect(previewPane).toBeTruthy();
      expect(previewPane?.textContent).toContain('Test Note');
    });

    it('should handle preview errors', async () => {
      mockJoplinService.getNote.mockRejectedValue(new Error('Note not found'));

      const firstResult = mockContainerEl.querySelector('.search-result-item') as HTMLElement;
      firstResult.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      const previewPane = mockContainerEl.querySelector('.preview-pane');
      expect(previewPane?.textContent).toContain('Failed to load preview');
    });

    it('should show loading state during preview', async () => {
      let resolveGetNote: (value: any) => void;
      const getNotePromise = new Promise(resolve => {
        resolveGetNote = resolve;
      });
      mockJoplinService.getNote.mockReturnValue(getNotePromise);

      const firstResult = mockContainerEl.querySelector('.search-result-item') as HTMLElement;
      firstResult.click();

      const previewPane = mockContainerEl.querySelector('.preview-pane');
      expect(previewPane?.textContent).toContain('Loading...');

      resolveGetNote!(mockJoplinNotes[0]);
      await getNotePromise;

      expect(previewPane?.textContent).toContain('Test Note');
    });
  });

  describe('search result interaction', () => {
    beforeEach(async () => {
      mockJoplinService.searchNotes.mockResolvedValue(mockJoplinNotes);
      await view.onOpen();

      const searchInput = mockContainerEl.querySelector('input[type="text"]') as HTMLInputElement;
      const searchButton = mockContainerEl.querySelector('button') as HTMLButtonElement;

      searchInput.value = 'test';
      searchButton.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should allow selecting multiple results for import', () => {
      const checkboxes = mockContainerEl.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(3);

      // Select first and third results
      (checkboxes[0] as HTMLInputElement).checked = true;
      (checkboxes[2] as HTMLInputElement).checked = true;

      checkboxes[0].dispatchEvent(new Event('change'));
      checkboxes[2].dispatchEvent(new Event('change'));

      const importButton = mockContainerEl.querySelector('.import-button') as HTMLButtonElement;
      expect(importButton.disabled).toBe(false);
    });

    it('should disable import button when no results selected', () => {
      const importButton = mockContainerEl.querySelector('.import-button') as HTMLButtonElement;
      expect(importButton.disabled).toBe(true);
    });

    it('should show import options when results are selected', () => {
      const checkbox = mockContainerEl.querySelector('input[type="checkbox"]') as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));

      const importOptions = mockContainerEl.querySelector('.import-options');
      expect(importOptions).toBeTruthy();
      expect(importOptions?.style.display).not.toBe('none');
    });
  });

  describe('keyboard navigation', () => {
    beforeEach(async () => {
      mockJoplinService.searchNotes.mockResolvedValue(mockJoplinNotes);
      await view.onOpen();
    });

    it('should trigger search on Enter key', async () => {
      const searchInput = mockContainerEl.querySelector('input[type="text"]') as HTMLInputElement;

      searchInput.value = 'test';
      searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockJoplinService.searchNotes).toHaveBeenCalledWith('test', { limit: 50 });
    });

    it('should navigate results with arrow keys', async () => {
      // First perform a search
      const searchInput = mockContainerEl.querySelector('input[type="text"]') as HTMLInputElement;
      const searchButton = mockContainerEl.querySelector('button') as HTMLButtonElement;

      searchInput.value = 'test';
      searchButton.click();
      await new Promise(resolve => setTimeout(resolve, 0));

      const resultItems = mockContainerEl.querySelectorAll('.search-result-item');

      // Simulate arrow down key
      mockContainerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(resultItems[0]).toHaveClass('selected');

      // Simulate another arrow down key
      mockContainerEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(resultItems[1]).toHaveClass('selected');
      expect(resultItems[0]).not.toHaveClass('selected');
    });
  });
});