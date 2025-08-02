import { vi } from 'vitest';

// Mock Obsidian API classes and functions
export class Plugin {
  app: any;
  manifest: any;

  constructor(app: any, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }

  async onload() {}
  async onunload() {}
  async loadData() { return {}; }
  async saveData(data: any) {}
}

export class ItemView {
  containerEl: HTMLElement;

	constructor() {
		const container = document.createElement('div');
		const childrenContainer = document.createElement('div');
		container.appendChild(childrenContainer);

		Object.defineProperty(container, 'children', {
			value: [document.createElement('div'), childrenContainer],
			writable: false,
		});

		this.containerEl = container as HTMLElement;
		this.containerEl.empty = vi.fn();
		this.containerEl.createDiv = vi.fn().mockImplementation((options) => {
			const div = document.createElement('div');
			if (options && options.cls) {
				div.className = options.cls;
			}
			childrenContainer.appendChild(div);
			return div;
		});
	}

  getViewType() { return 'test-view'; }
  getDisplayText() { return 'Test View'; }
  async onOpen() {}
  async onClose() {}
}

export class PluginSettingTab {
  containerEl: HTMLElement;
  app: any;
  plugin: any;

  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
		this.containerEl = document.createElement('div');
		this.containerEl.empty = vi.fn();
		this.containerEl.createEl = vi.fn().mockImplementation((tag, options) => {
			const el = document.createElement(tag);
			if (options && options.text) {
				el.textContent = options.text;
			}
			this.containerEl.appendChild(el);
			return el;
		});
  }

  display() {}
}

export class TFile {
  path: string;
  name: string;

  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
  }
}

export class TFolder {
  path: string;
  name: string;

  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
  }
}

export const Notice = vi.fn();
export const requestUrl = vi.fn();
export const normalizePath = vi.fn((path: string) => path);

export const MarkdownRenderer = {
  render: vi.fn(),
  renderMarkdown: vi.fn(),
};

export const debounce = (fn: (...args: any[]) => any, _delay: number) => {
	return fn;
};

// Mock settings
export const Setting = vi.fn().mockImplementation(() => ({
  setName: vi.fn().mockReturnThis(),
  setDesc: vi.fn().mockReturnThis(),
  addText: vi.fn().mockReturnThis(),
  addTextArea: vi.fn().mockReturnThis(),
  addToggle: vi.fn().mockReturnThis(),
  addDropdown: vi.fn().mockReturnThis(),
  addButton: vi.fn().mockReturnThis(),
  onChange: vi.fn().mockReturnThis(),
}));

// Export default for ES module compatibility
export default {
  Plugin,
  ItemView,
  PluginSettingTab,
  TFile,
  TFolder,
  Notice,
  requestUrl,
  normalizePath,
  Setting,
  MarkdownRenderer,
  debounce,
};