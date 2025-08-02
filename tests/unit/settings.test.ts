import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JoplinPortalSettingTab } from '../../src/settings';
import { JoplinApiService } from '../../src/joplin-api-service';

vi.mock('obsidian');
vi.mock('../../src/joplin-api-service');

describe('JoplinPortalSettingTab', () => {
  let settingTab: JoplinPortalSettingTab;
  let mockPlugin: any;
  let mockApp: any;
  let mockContainerEl: HTMLElement;

  beforeEach(() => {
    mockContainerEl = document.createElement('div');

    mockApp = {
      setting: {
        settingTabs: []
      }
    };

    mockPlugin = {
      app: mockApp,
      settings: {
        serverUrl: 'http://localhost:41184',
        apiToken: 'test-token',
        defaultImportFolder: 'Joplin Notes',
        importTemplate: '',
        searchLimit: 50
      },
      saveSettings: vi.fn(),
      joplinService: {
        testConnection: vi.fn()
      }
    };

    settingTab = new JoplinPortalSettingTab(mockApp, mockPlugin);
    settingTab.containerEl = mockContainerEl;

    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with app and plugin', () => {
      expect(settingTab.plugin).toBe(mockPlugin);
      expect(settingTab.app).toBe(mockApp);
    });
  });

  describe('display', () => {
    it('should create settings UI elements', () => {
      settingTab.display();

      expect(mockContainerEl.children.length).toBeGreaterThan(0);

      // Check for server URL input
      const serverUrlInput = mockContainerEl.querySelector('input[type="text"]');
      expect(serverUrlInput).toBeTruthy();
      expect((serverUrlInput as HTMLInputElement).value).toBe('http://localhost:41184');
    });

    it('should create API token input with password type', () => {
      settingTab.display();

      const tokenInputs = mockContainerEl.querySelectorAll('input[type="password"]');
      expect(tokenInputs.length).toBeGreaterThan(0);
    });

    it('should create test connection button', () => {
      settingTab.display();

      const testButton = mockContainerEl.querySelector('button');
      expect(testButton).toBeTruthy();
      expect(testButton?.textContent).toContain('Test Connection');
    });

    it('should create import folder setting', () => {
      settingTab.display();

      const inputs = mockContainerEl.querySelectorAll('input[type="text"]');
      const folderInput = Array.from(inputs).find(input =>
        (input as HTMLInputElement).value === 'Joplin Notes'
      );
      expect(folderInput).toBeTruthy();
    });

    it('should create search limit setting', () => {
      settingTab.display();

      const numberInput = mockContainerEl.querySelector('input[type="number"]');
      expect(numberInput).toBeTruthy();
      expect((numberInput as HTMLInputElement).value).toBe('50');
    });
  });

  describe('setting updates', () => {
    beforeEach(() => {
      settingTab.display();
    });

    it('should update server URL setting', () => {
      const serverUrlInput = mockContainerEl.querySelector('input[type="text"]') as HTMLInputElement;

      serverUrlInput.value = 'http://localhost:8080';
      serverUrlInput.dispatchEvent(new Event('input'));

      expect(mockPlugin.settings.serverUrl).toBe('http://localhost:8080');
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it('should update API token setting', () => {
      const tokenInput = mockContainerEl.querySelector('input[type="password"]') as HTMLInputElement;

      tokenInput.value = 'new-token';
      tokenInput.dispatchEvent(new Event('input'));

      expect(mockPlugin.settings.apiToken).toBe('new-token');
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it('should update search limit setting', () => {
      const limitInput = mockContainerEl.querySelector('input[type="number"]') as HTMLInputElement;

      limitInput.value = '100';
      limitInput.dispatchEvent(new Event('input'));

      expect(mockPlugin.settings.searchLimit).toBe(100);
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it('should validate search limit bounds', () => {
      const limitInput = mockContainerEl.querySelector('input[type="number"]') as HTMLInputElement;

      // Test minimum bound
      limitInput.value = '0';
      limitInput.dispatchEvent(new Event('input'));
      expect(mockPlugin.settings.searchLimit).toBe(1);

      // Test maximum bound
      limitInput.value = '1000';
      limitInput.dispatchEvent(new Event('input'));
      expect(mockPlugin.settings.searchLimit).toBe(500);
    });
  });

  describe('connection testing', () => {
    beforeEach(() => {
      settingTab.display();
    });

    it('should test connection successfully', async () => {
      mockPlugin.joplinService.testConnection.mockResolvedValue(true);

      const testButton = mockContainerEl.querySelector('button') as HTMLButtonElement;
      testButton.click();

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockPlugin.joplinService.testConnection).toHaveBeenCalled();
      expect(testButton.textContent).toContain('✓');
    });

    it('should handle connection failure', async () => {
      mockPlugin.joplinService.testConnection.mockResolvedValue(false);

      const testButton = mockContainerEl.querySelector('button') as HTMLButtonElement;
      testButton.click();

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(testButton.textContent).toContain('✗');
    });

    it('should handle connection error', async () => {
      mockPlugin.joplinService.testConnection.mockRejectedValue(new Error('Network error'));

      const testButton = mockContainerEl.querySelector('button') as HTMLButtonElement;
      testButton.click();

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(testButton.textContent).toContain('✗');
    });

    it('should disable button during testing', async () => {
      let resolveConnection: (value: boolean) => void;
      const connectionPromise = new Promise<boolean>(resolve => {
        resolveConnection = resolve;
      });
      mockPlugin.joplinService.testConnection.mockReturnValue(connectionPromise);

      const testButton = mockContainerEl.querySelector('button') as HTMLButtonElement;
      testButton.click();

      expect(testButton.disabled).toBe(true);
      expect(testButton.textContent).toContain('Testing...');

      resolveConnection!(true);
      await connectionPromise;

      expect(testButton.disabled).toBe(false);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      settingTab.display();
    });

    it('should validate server URL format', () => {
      const serverUrlInput = mockContainerEl.querySelector('input[type="text"]') as HTMLInputElement;

      // Test invalid URL
      serverUrlInput.value = 'not-a-url';
      serverUrlInput.dispatchEvent(new Event('blur'));

      // Should show validation error
      const errorElement = mockContainerEl.querySelector('.setting-item-description');
      expect(errorElement?.textContent).toContain('Invalid URL format');
    });

    it('should validate API token presence', () => {
      const tokenInput = mockContainerEl.querySelector('input[type="password"]') as HTMLInputElement;

      tokenInput.value = '';
      tokenInput.dispatchEvent(new Event('blur'));

      const errorElement = mockContainerEl.querySelector('.setting-item-description');
      expect(errorElement?.textContent).toContain('API token is required');
    });

    it('should validate import folder name', () => {
      const inputs = mockContainerEl.querySelectorAll('input[type="text"]');
      const folderInput = Array.from(inputs).find(input =>
        (input as HTMLInputElement).value === 'Joplin Notes'
      ) as HTMLInputElement;

      folderInput.value = 'folder/with/invalid<>chars';
      folderInput.dispatchEvent(new Event('blur'));

      const errorElement = mockContainerEl.querySelector('.setting-item-description');
      expect(errorElement?.textContent).toContain('Invalid folder name');
    });
  });

  describe('settings persistence', () => {
    it('should save settings when values change', () => {
      settingTab.display();

      const serverUrlInput = mockContainerEl.querySelector('input[type="text"]') as HTMLInputElement;
      serverUrlInput.value = 'http://new-server:8080';
      serverUrlInput.dispatchEvent(new Event('input'));

      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it('should not save settings for invalid values', () => {
      settingTab.display();
      mockPlugin.saveSettings.mockClear();

      const serverUrlInput = mockContainerEl.querySelector('input[type="text"]') as HTMLInputElement;
      serverUrlInput.value = 'invalid-url';
      serverUrlInput.dispatchEvent(new Event('blur'));

      expect(mockPlugin.saveSettings).not.toHaveBeenCalled();
    });
  });
});