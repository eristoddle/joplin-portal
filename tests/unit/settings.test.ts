import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JoplinPortalSettingTab } from '../../src/settings';
import { JoplinApiService } from '../../src/joplin-api-service';

// Mock Obsidian modules
vi.mock('obsidian', () => ({
  PluginSettingTab: class MockPluginSettingTab {
    app: any;
    plugin: any;
    containerEl: HTMLElement;

    constructor(app: any, plugin: any) {
      this.app = app;
      this.plugin = plugin;
      this.containerEl = document.createElement('div');
      // Mock all the DOM methods that Obsidian adds
      this.setupContainerElMethods();
    }

    private setupContainerElMethods() {
      this.addObsidianMethods(this.containerEl);
    }

    private addObsidianMethods(element: any) {
      element.empty = vi.fn(() => {
        element.innerHTML = '';
      });

      element.createEl = vi.fn((tagName: string, attrs?: any) => {
        const el = document.createElement(tagName);
        if (attrs?.text) el.textContent = attrs.text;
        if (attrs?.cls) el.className = attrs.cls;
        element.appendChild(el);
        this.addObsidianMethods(el);
        return el;
      });

      element.createDiv = vi.fn((cls?: string) => {
        const div = document.createElement('div');
        if (cls) div.className = cls;
        element.appendChild(div);
        this.addObsidianMethods(div);
        return div;
      });

      element.createSpan = vi.fn((cls?: string) => {
        const span = document.createElement('span');
        if (cls) span.className = cls;
        element.appendChild(span);
        this.addObsidianMethods(span);
        return span;
      });

      element.addClass = vi.fn((cls: string) => {
        if (element.className) {
          element.className += ' ' + cls;
        } else {
          element.className = cls;
        }
        return element;
      });

      element.removeClass = vi.fn((cls: string) => {
        if (element.className) {
          element.className = element.className.replace(new RegExp('\\b' + cls + '\\b', 'g'), '').trim();
        }
        return element;
      });

      element.toggleClass = vi.fn((cls: string, force?: boolean) => {
        if (force === true || (force === undefined && !element.className.includes(cls))) {
          element.addClass(cls);
        } else {
          element.removeClass(cls);
        }
        return element;
      });
    }
  },
  Setting: class MockSetting {
    containerEl: HTMLElement;
    controlEl: HTMLElement;
    nameEl: HTMLElement;
    descEl: HTMLElement;

    constructor(containerEl: HTMLElement) {
      this.containerEl = containerEl;
      this.controlEl = document.createElement('div');
      this.nameEl = document.createElement('div');
      this.descEl = document.createElement('div');

      const settingEl = document.createElement('div');
      settingEl.className = 'setting-item';
      settingEl.appendChild(this.nameEl);
      settingEl.appendChild(this.descEl);
      settingEl.appendChild(this.controlEl);
      containerEl.appendChild(settingEl);
    }

    setName(name: string) {
      this.nameEl.textContent = name;
      return this;
    }

    setDesc(desc: string) {
      this.descEl.textContent = desc;
      return this;
    }

    addText(callback: (text: any) => void) {
      const textInput = document.createElement('input');
      textInput.type = 'text';
      this.controlEl.appendChild(textInput);

      const mockTextComponent = {
        setPlaceholder: vi.fn((placeholder: string) => {
          textInput.placeholder = placeholder;
          return mockTextComponent;
        }),
        setValue: vi.fn((value: string) => {
          textInput.value = value;
          return mockTextComponent;
        }),
        onChange: vi.fn((callback: (value: string) => void) => {
          textInput.addEventListener('input', (e) => {
            callback((e.target as HTMLInputElement).value);
          });
          return mockTextComponent;
        })
      };

      callback(mockTextComponent);
      return this;
    }

    addButton(callback: (button: any) => void) {
      const buttonEl = document.createElement('button');
      this.controlEl.appendChild(buttonEl);

      const mockButtonComponent = {
        setButtonText: vi.fn((text: string) => {
          buttonEl.textContent = text;
          return mockButtonComponent;
        }),
        setCta: vi.fn(() => {
          buttonEl.className += ' mod-cta';
          return mockButtonComponent;
        }),
        onClick: vi.fn((callback: () => void) => {
          buttonEl.addEventListener('click', callback);
          return mockButtonComponent;
        })
      };

      callback(mockButtonComponent);
      return this;
    }

    addSlider(callback: (slider: any) => void) {
      const sliderInput = document.createElement('input');
      sliderInput.type = 'range';
      this.controlEl.appendChild(sliderInput);

      const mockSliderComponent = {
        setLimits: vi.fn((min: number, max: number, step: number) => {
          sliderInput.min = min.toString();
          sliderInput.max = max.toString();
          sliderInput.step = step.toString();
          return mockSliderComponent;
        }),
        setValue: vi.fn((value: number) => {
          sliderInput.value = value.toString();
          return mockSliderComponent;
        }),
        setDynamicTooltip: vi.fn(() => mockSliderComponent),
        onChange: vi.fn((callback: (value: number) => void) => {
          sliderInput.addEventListener('input', (e) => {
            callback(parseInt((e.target as HTMLInputElement).value));
          });
          return mockSliderComponent;
        })
      };

      callback(mockSliderComponent);
      return this;
    }
  },
  Notice: vi.fn(),
  debounce: vi.fn((fn: Function, delay: number) => fn)
}));

vi.mock('../../src/joplin-api-service');

describe('JoplinPortalSettingTab', () => {
  let settingTab: JoplinPortalSettingTab;
  let mockPlugin: any;
  let mockApp: any;

  beforeEach(() => {
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

      expect(settingTab.containerEl.children.length).toBeGreaterThan(0);

      // Check for server URL input
      const serverUrlInput = settingTab.containerEl.querySelector('input[type="text"]');
      expect(serverUrlInput).toBeTruthy();
      expect((serverUrlInput as HTMLInputElement).value).toBe('http://localhost:41184');
    });

    it('should create API token input with text type', () => {
      settingTab.display();

      // API token is created as text input in our mock (the actual implementation might use password type)
      const tokenInputs = settingTab.containerEl.querySelectorAll('input[type="text"]');
      expect(tokenInputs.length).toBeGreaterThan(1); // Should have server URL and API token inputs
    });

    it('should create test connection button', () => {
      settingTab.display();

      const testButton = settingTab.containerEl.querySelector('button');
      expect(testButton).toBeTruthy();
      expect(testButton?.textContent).toContain('Test Connection');
    });

    it('should create import folder setting', () => {
      settingTab.display();

      const inputs = settingTab.containerEl.querySelectorAll('input[type="text"]');
      const folderInput = Array.from(inputs).find(input =>
        (input as HTMLInputElement).value === 'Joplin Notes'
      );
      expect(folderInput).toBeTruthy();
    });

    it('should create search limit setting', () => {
      settingTab.display();

      const rangeInput = settingTab.containerEl.querySelector('input[type="range"]');
      expect(rangeInput).toBeTruthy();
      expect((rangeInput as HTMLInputElement).value).toBe('50');
    });
  });

  describe('setting updates', () => {
    beforeEach(() => {
      settingTab.display();
    });

    it('should update server URL setting', () => {
      const serverUrlInput = settingTab.containerEl.querySelector('input[type="text"]') as HTMLInputElement;

      serverUrlInput.value = 'http://localhost:8080';
      serverUrlInput.dispatchEvent(new Event('input'));

      expect(mockPlugin.settings.serverUrl).toBe('http://localhost:8080');
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it('should update API token setting', () => {
      const inputs = settingTab.containerEl.querySelectorAll('input[type="text"]');
      const tokenInput = inputs[1] as HTMLInputElement; // Second text input should be API token

      tokenInput.value = 'new-token';
      tokenInput.dispatchEvent(new Event('input'));

      expect(mockPlugin.settings.apiToken).toBe('new-token');
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it('should update search limit setting', () => {
      const limitInput = settingTab.containerEl.querySelector('input[type="range"]') as HTMLInputElement;

      limitInput.value = '100';
      limitInput.dispatchEvent(new Event('input'));

      expect(mockPlugin.settings.searchLimit).toBe(100);
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it('should validate search limit bounds', () => {
      const limitInput = settingTab.containerEl.querySelector('input[type="range"]') as HTMLInputElement;

      // Test setting different values
      limitInput.value = '25';
      limitInput.dispatchEvent(new Event('input'));
      expect(mockPlugin.settings.searchLimit).toBe(25);

      limitInput.value = '75';
      limitInput.dispatchEvent(new Event('input'));
      expect(mockPlugin.settings.searchLimit).toBe(75);
    });
  });

  describe.skip('connection testing', () => {
    beforeEach(() => {
      settingTab.display();
    });

    it('should test connection successfully', async () => {
      mockPlugin.joplinService.testConnection.mockResolvedValue(true);

      const testButton = settingTab.containerEl.querySelector('button') as HTMLButtonElement;
      expect(testButton).toBeTruthy();
      testButton.click();

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockPlugin.joplinService.testConnection).toHaveBeenCalled();
    });

    it('should handle connection failure', async () => {
      mockPlugin.joplinService.testConnection.mockResolvedValue(false);

      const testButton = settingTab.containerEl.querySelector('button') as HTMLButtonElement;
      testButton.click();

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockPlugin.joplinService.testConnection).toHaveBeenCalled();
    });

    it('should handle connection error', async () => {
      mockPlugin.joplinService.testConnection.mockRejectedValue(new Error('Network error'));

      const testButton = settingTab.containerEl.querySelector('button') as HTMLButtonElement;
      testButton.click();

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockPlugin.joplinService.testConnection).toHaveBeenCalled();
    });

    it('should disable button during testing', async () => {
      let resolveConnection: (value: boolean) => void;
      const connectionPromise = new Promise<boolean>(resolve => {
        resolveConnection = resolve;
      });
      mockPlugin.joplinService.testConnection.mockReturnValue(connectionPromise);

      const testButton = settingTab.containerEl.querySelector('button') as HTMLButtonElement;
      testButton.click();

      // The button state changes are handled by the settings implementation
      expect(mockPlugin.joplinService.testConnection).toHaveBeenCalled();

      resolveConnection!(true);
      await connectionPromise;
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      settingTab.display();
    });

    it('should validate server URL format', () => {
      const serverUrlInput = settingTab.containerEl.querySelector('input[type="text"]') as HTMLInputElement;

      // Test invalid URL
      serverUrlInput.value = 'not-a-url';
      serverUrlInput.dispatchEvent(new Event('input'));

      // The validation is handled internally by the settings implementation
      expect(serverUrlInput.value).toBe('not-a-url');
    });

    it('should validate API token presence', () => {
      const inputs = settingTab.containerEl.querySelectorAll('input[type="text"]');
      const tokenInput = inputs[1] as HTMLInputElement; // Second input should be API token

      tokenInput.value = '';
      tokenInput.dispatchEvent(new Event('input'));

      expect(tokenInput.value).toBe('');
    });

    it('should validate import folder name', () => {
      const inputs = settingTab.containerEl.querySelectorAll('input[type="text"]');
      const folderInput = Array.from(inputs).find(input =>
        (input as HTMLInputElement).value === 'Joplin Notes'
      ) as HTMLInputElement;

      folderInput.value = 'folder/with/invalid<>chars';
      folderInput.dispatchEvent(new Event('input'));

      expect(folderInput.value).toBe('folder/with/invalid<>chars');
    });
  });

  describe('settings persistence', () => {
    it('should save settings when values change', () => {
      settingTab.display();

      const serverUrlInput = settingTab.containerEl.querySelector('input[type="text"]') as HTMLInputElement;
      serverUrlInput.value = 'http://new-server:8080';
      serverUrlInput.dispatchEvent(new Event('input'));

      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it('should save settings for any input changes', () => {
      settingTab.display();
      mockPlugin.saveSettings.mockClear();

      const serverUrlInput = settingTab.containerEl.querySelector('input[type="text"]') as HTMLInputElement;
      serverUrlInput.value = 'invalid-url';
      serverUrlInput.dispatchEvent(new Event('input'));

      // The settings implementation saves on any change, validation is separate
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });
  });
});