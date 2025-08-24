import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JoplinPortalView } from '../../src/joplin-portal-view';
import { ImportService } from '../../src/import-service';
import { mockJoplinNotes } from '../mocks/joplin-api-mocks';
import { TFile } from 'obsidian';

vi.mock('obsidian');
vi.mock('../../src/import-service');

describe.skip('Import Workflow Integration', () => {
  let view: JoplinPortalView;
  let mockPlugin: any;
  let mockImportService: any;
  let mockJoplinService: any;
  let mockContainerEl: HTMLElement;

  beforeEach(() => {
    mockContainerEl = document.createElement('div');

    mockImportService = {
      importNote: vi.fn(),
      importMultipleNotes: vi.fn()
    };

    mockJoplinService = {
      searchNotes: vi.fn(),
      getNote: vi.fn()
    };

    mockPlugin = {
      settings: {
        serverUrl: 'http://localhost:41184',
        apiToken: 'test-token',
        defaultImportFolder: 'Joplin Notes',
        importTemplate: '',
        searchLimit: 50,
        debugMode: false,
        includeMetadataInFrontmatter: true
      },
      joplinService: mockJoplinService,
      importService: mockImportService
    };

    view = new JoplinPortalView({} as any, mockPlugin);
    view.containerEl = mockContainerEl;

    vi.clearAllMocks();
  });

  describe('complete import workflow', () => {
    beforeEach(async () => {
      // Setup search results first
      mockJoplinService.searchNotes.mockResolvedValue(mockJoplinNotes);
      await view.onOpen();

      const searchInput = mockContainerEl.querySelector('input[type="text"]') as HTMLInputElement;
      const searchButton = mockContainerEl.querySelector('button') as HTMLButtonElement;

      searchInput.value = 'test';
      searchButton.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should import selected notes successfully', async () => {
      mockImportService.importMultipleNotes.mockResolvedValue([
        { success: true, filePath: 'Joplin Notes/Test Note.md' },
        { success: true, filePath: 'Joplin Notes/Another Test Note.md' }
      ]);

      // Select first two results
      const checkboxes = mockContainerEl.querySelectorAll('input[type="checkbox"]');
      (checkboxes[0] as HTMLInputElement).checked = true;
      (checkboxes[1] as HTMLInputElement).checked = true;

      checkboxes[0].dispatchEvent(new Event('change'));
      checkboxes[1].dispatchEvent(new Event('change'));

      // Click import button
      const importButton = mockContainerEl.querySelector('.import-button') as HTMLButtonElement;
      importButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockImportService.importMultipleNotes).toHaveBeenCalledWith(
        [mockJoplinNotes[0], mockJoplinNotes[1]],
        'Joplin Notes',
        { conflictResolution: 'rename' },
        expect.any(Function) // progress callback
      );

      // Check success message
      const successMessage = mockContainerEl.querySelector('.import-success');
      expect(successMessage).toBeTruthy();
      expect(successMessage?.textContent).toContain('2 notes imported successfully');
    });

    it('should handle import failures gracefully', async () => {
      mockImportService.importMultipleNotes.mockResolvedValue([
        { success: true, filePath: 'Joplin Notes/Test Note.md' },
        { success: false, error: 'Permission denied', filePath: 'Joplin Notes/Another Test Note.md' }
      ]);

      const checkboxes = mockContainerEl.querySelectorAll('input[type="checkbox"]');
      (checkboxes[0] as HTMLInputElement).checked = true;
      (checkboxes[1] as HTMLInputElement).checked = true;

      checkboxes[0].dispatchEvent(new Event('change'));
      checkboxes[1].dispatchEvent(new Event('change'));

      const importButton = mockContainerEl.querySelector('.import-button') as HTMLButtonElement;
      importButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      const partialSuccessMessage = mockContainerEl.querySelector('.import-partial-success');
      expect(partialSuccessMessage).toBeTruthy();
      expect(partialSuccessMessage?.textContent).toContain('1 of 2 notes imported');

      const errorDetails = mockContainerEl.querySelector('.import-errors');
      expect(errorDetails?.textContent).toContain('Permission denied');
    });

    it('should show progress during import', async () => {
      let progressCallback: (current: number, total: number) => void;

      mockImportService.importMultipleNotes.mockImplementation(
        (notes: any[], folder: string, options: any, callback: any) => {
          progressCallback = callback;
          return new Promise(resolve => {
            setTimeout(() => {
              progressCallback(1, 2);
              setTimeout(() => {
                progressCallback(2, 2);
                resolve([
                  { success: true, filePath: 'Joplin Notes/Test Note.md' },
                  { success: true, filePath: 'Joplin Notes/Another Test Note.md' }
                ]);
              }, 100);
            }, 100);
          });
        }
      );

      const checkboxes = mockContainerEl.querySelectorAll('input[type="checkbox"]');
      (checkboxes[0] as HTMLInputElement).checked = true;
      (checkboxes[1] as HTMLInputElement).checked = true;

      checkboxes[0].dispatchEvent(new Event('change'));
      checkboxes[1].dispatchEvent(new Event('change'));

      const importButton = mockContainerEl.querySelector('.import-button') as HTMLButtonElement;
      importButton.click();

      // Check initial progress
      await new Promise(resolve => setTimeout(resolve, 50));
      const progressBar = mockContainerEl.querySelector('.progress-bar') as HTMLElement;
      expect(progressBar).toBeTruthy();

      // Check mid progress
      await new Promise(resolve => setTimeout(resolve, 100));
      expect((progressBar as HTMLElement).style.width).toBe('50%');

      // Check completion
      await new Promise(resolve => setTimeout(resolve, 150));
      expect((progressBar as HTMLElement).style.width).toBe('100%');
    });
  });

  describe('import options configuration', () => {
    beforeEach(async () => {
      mockJoplinService.searchNotes.mockResolvedValue(mockJoplinNotes);
      await view.onOpen();

      const searchInput = mockContainerEl.querySelector('input[type="text"]') as HTMLInputElement;
      const searchButton = mockContainerEl.querySelector('button') as HTMLButtonElement;

      searchInput.value = 'test';
      searchButton.click();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Select a result to show import options
      const checkbox = mockContainerEl.querySelector('input[type="checkbox"]') as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
    });

    it('should allow changing target folder', async () => {
      mockImportService.importMultipleNotes.mockResolvedValue([
        { success: true, filePath: 'Custom Folder/Test Note.md' }
      ]);

      const folderInput = mockContainerEl.querySelector('.folder-input') as HTMLInputElement;
      folderInput.value = 'Custom Folder';
      folderInput.dispatchEvent(new Event('input'));

      const importButton = mockContainerEl.querySelector('.import-button') as HTMLButtonElement;
      importButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockImportService.importMultipleNotes).toHaveBeenCalledWith(
        [mockJoplinNotes[0]],
        'Custom Folder',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should allow changing conflict resolution strategy', async () => {
      mockImportService.importMultipleNotes.mockResolvedValue([
        { success: true, filePath: 'Joplin Notes/Test Note.md' }
      ]);

      const conflictSelect = mockContainerEl.querySelector('.conflict-resolution') as HTMLSelectElement;
      conflictSelect.value = 'overwrite';
      conflictSelect.dispatchEvent(new Event('change'));

      const importButton = mockContainerEl.querySelector('.import-button') as HTMLButtonElement;
      importButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockImportService.importMultipleNotes).toHaveBeenCalledWith(
        [mockJoplinNotes[0]],
        'Joplin Notes',
        { conflictResolution: 'overwrite' },
        expect.any(Function)
      );
    });

    it('should validate folder name', () => {
      const folderInput = mockContainerEl.querySelector('.folder-input') as HTMLInputElement;
      folderInput.value = 'invalid/folder<>name';
      folderInput.dispatchEvent(new Event('blur'));

      const errorMessage = mockContainerEl.querySelector('.folder-error');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.textContent).toContain('Invalid folder name');

      const importButton = mockContainerEl.querySelector('.import-button') as HTMLButtonElement;
      expect(importButton.disabled).toBe(true);
    });
  });

  describe('import confirmation dialog', () => {
    beforeEach(async () => {
      mockJoplinService.searchNotes.mockResolvedValue(mockJoplinNotes);
      await view.onOpen();

      const searchInput = mockContainerEl.querySelector('input[type="text"]') as HTMLInputElement;
      const searchButton = mockContainerEl.querySelector('button') as HTMLButtonElement;

      searchInput.value = 'test';
      searchButton.click();
      await new Promise(resolve => setTimeout(resolve, 0));

      const checkboxes = mockContainerEl.querySelectorAll('input[type="checkbox"]');
      (checkboxes[0] as HTMLInputElement).checked = true;
      (checkboxes[1] as HTMLInputElement).checked = true;

      checkboxes[0].dispatchEvent(new Event('change'));
      checkboxes[1].dispatchEvent(new Event('change'));
    });

    it('should show confirmation dialog before import', () => {
      const importButton = mockContainerEl.querySelector('.import-button') as HTMLButtonElement;
      importButton.click();

      const confirmDialog = mockContainerEl.querySelector('.import-confirmation');
      expect(confirmDialog).toBeTruthy();
      expect(confirmDialog?.textContent).toContain('Import 2 notes');
    });

    it('should proceed with import on confirmation', async () => {
      mockImportService.importMultipleNotes.mockResolvedValue([
        { success: true, filePath: 'Joplin Notes/Test Note.md' },
        { success: true, filePath: 'Joplin Notes/Another Test Note.md' }
      ]);

      const importButton = mockContainerEl.querySelector('.import-button') as HTMLButtonElement;
      importButton.click();

      const confirmButton = mockContainerEl.querySelector('.confirm-import') as HTMLButtonElement;
      confirmButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockImportService.importMultipleNotes).toHaveBeenCalled();
    });

    it('should cancel import on dialog cancel', () => {
      const importButton = mockContainerEl.querySelector('.import-button') as HTMLButtonElement;
      importButton.click();

      const cancelButton = mockContainerEl.querySelector('.cancel-import') as HTMLButtonElement;
      cancelButton.click();

      expect(mockImportService.importMultipleNotes).not.toHaveBeenCalled();

      const confirmDialog = mockContainerEl.querySelector('.import-confirmation');
      expect((confirmDialog as HTMLElement)?.style.display).toBe('none');
    });
  });

  describe('post-import actions', () => {
    beforeEach(async () => {
      mockJoplinService.searchNotes.mockResolvedValue(mockJoplinNotes);
      await view.onOpen();

      const searchInput = mockContainerEl.querySelector('input[type="text"]') as HTMLInputElement;
      const searchButton = mockContainerEl.querySelector('button') as HTMLButtonElement;

      searchInput.value = 'test';
      searchButton.click();
      await new Promise(resolve => setTimeout(resolve, 0));

      const checkbox = mockContainerEl.querySelector('input[type="checkbox"]') as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
    });

    it('should clear selection after successful import', async () => {
      mockImportService.importMultipleNotes.mockResolvedValue([
        { success: true, filePath: 'Joplin Notes/Test Note.md' }
      ]);

      const importButton = mockContainerEl.querySelector('.import-button') as HTMLButtonElement;
      importButton.click();

      const confirmButton = mockContainerEl.querySelector('.confirm-import') as HTMLButtonElement;
      confirmButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      const checkboxes = mockContainerEl.querySelectorAll('input[type="checkbox"]');
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
      expect(importButton.disabled).toBe(true);
    });

    it('should provide option to open imported files', async () => {
      mockImportService.importMultipleNotes.mockResolvedValue([
        { success: true, filePath: 'Joplin Notes/Test Note.md' }
      ]);

      const importButton = mockContainerEl.querySelector('.import-button') as HTMLButtonElement;
      importButton.click();

      const confirmButton = mockContainerEl.querySelector('.confirm-import') as HTMLButtonElement;
      confirmButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      const openFileButton = mockContainerEl.querySelector('.open-imported-file') as HTMLButtonElement;
      expect(openFileButton).toBeTruthy();
      expect(openFileButton.textContent).toContain('Open imported note');
    });

    it('should show import summary with statistics', async () => {
      mockImportService.importMultipleNotes.mockResolvedValue([
        { success: true, filePath: 'Joplin Notes/Test Note.md' },
        { success: false, error: 'Failed', filePath: 'Joplin Notes/Failed Note.md' },
        { success: true, filePath: 'Joplin Notes/Another Note.md' }
      ]);

      const checkboxes = mockContainerEl.querySelectorAll('input[type="checkbox"]');
      (checkboxes[0] as HTMLInputElement).checked = true;
      (checkboxes[1] as HTMLInputElement).checked = true;
      (checkboxes[2] as HTMLInputElement).checked = true;

      checkboxes[1].dispatchEvent(new Event('change'));
      checkboxes[2].dispatchEvent(new Event('change'));

      const importButton = mockContainerEl.querySelector('.import-button') as HTMLButtonElement;
      importButton.click();

      const confirmButton = mockContainerEl.querySelector('.confirm-import') as HTMLButtonElement;
      confirmButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      const summary = mockContainerEl.querySelector('.import-summary');
      expect(summary?.textContent).toContain('2 successful');
      expect(summary?.textContent).toContain('1 failed');
    });
  });
});