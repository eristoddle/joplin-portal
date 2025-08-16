import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import JoplinPortalPlugin from '../../main';

// Mock the dependencies
vi.mock('obsidian', () => import('../mocks/obsidian-mock'));

describe('Plugin Compatibility Tests', () => {
  let plugin: JoplinPortalPlugin;
  let mockApp: any;
  let mockManifest: any;

  beforeEach(async () => {
    mockApp = {
      workspace: {
        getLeavesOfType: vi.fn().mockReturnValue([]),
        getRightLeaf: vi.fn().mockReturnValue({
          setViewState: vi.fn(),
        }),
        revealLeaf: vi.fn(),
      },
      vault: {
        create: vi.fn(),
        createFolder: vi.fn(),
        adapter: {
          exists: vi.fn().mockResolvedValue(false),
        },
      },
      setting: {
        open: vi.fn(),
        openTabById: vi.fn(),
      },
      commands: {
        executeCommandById: vi.fn(),
        listCommands: vi.fn().mockReturnValue([]),
      },
      keymap: {
        getHotkeys: vi.fn().mockReturnValue([]),
        setHotkeys: vi.fn(),
      },
    };

    mockManifest = {
      id: 'joplin-portal',
      name: 'Joplin Portal',
      version: '1.0.0',
    };

    plugin = new JoplinPortalPlugin(mockApp, mockManifest);
    plugin.loadData = vi.fn().mockResolvedValue({});
    await plugin.onload();
  });

  afterEach(async () => {
    if (plugin) {
      await plugin.onunload();
    }
    vi.clearAllMocks();
  });

  describe('Popular Plugin Command Compatibility', () => {
    it('should not conflict with Templater plugin commands', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // Common Templater command patterns
      const templaterCommands = [
        'templater-create-new-note-from-template',
        'templater-replace-in-file-templater',
        'templater-jump-to-next-cursor-location',
        'templater-create-new-note-from-template',
      ];

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];
        expect(templaterCommands).not.toContain(commandConfig.id);
      });
    });

    it('should not conflict with Calendar plugin commands', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // Common Calendar plugin command patterns
      const calendarCommands = [
        'calendar:open-weekly-note',
        'calendar:open-daily-note',
        'calendar:reveal-active-note',
      ];

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];
        expect(calendarCommands).not.toContain(commandConfig.id);
      });
    });

    it('should not conflict with Dataview plugin commands', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // Common Dataview plugin command patterns
      const dataviewCommands = [
        'dataview:refresh-views',
        'dataview:force-refresh-views',
        'dataview:drop-cache',
      ];

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];
        expect(dataviewCommands).not.toContain(commandConfig.id);
      });
    });

    it('should not conflict with Kanban plugin commands', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // Common Kanban plugin command patterns
      const kanbanCommands = [
        'obsidian-kanban:create-new-kanban-board',
        'obsidian-kanban:archive-completed-cards',
        'obsidian-kanban:toggle-kanban-view',
      ];

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];
        expect(kanbanCommands).not.toContain(commandConfig.id);
      });
    });

    it('should not conflict with Excalidraw plugin commands', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // Common Excalidraw plugin command patterns
      const excalidrawCommands = [
        'obsidian-excalidraw-plugin:create-new-drawing',
        'obsidian-excalidraw-plugin:toggle-excalidraw-view',
        'obsidian-excalidraw-plugin:insert-link-to-element',
      ];

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];
        expect(excalidrawCommands).not.toContain(commandConfig.id);
      });
    });
  });

  describe('Obsidian Core Command Compatibility', () => {
    it('should not conflict with core editor commands', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // Core editor commands that should not be overridden
      const coreEditorCommands = [
        'editor:focus',
        'editor:select-all',
        'editor:copy',
        'editor:paste',
        'editor:cut',
        'editor:undo',
        'editor:redo',
        'editor:follow-link',
        'editor:open-link-in-new-leaf',
        'editor:toggle-bold',
        'editor:toggle-italics',
        'editor:toggle-code',
      ];

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];
        expect(coreEditorCommands).not.toContain(commandConfig.id);
      });
    });

    it('should not conflict with core workspace commands', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // Core workspace commands
      const coreWorkspaceCommands = [
        'workspace:close',
        'workspace:close-tab',
        'workspace:close-others',
        'workspace:split-vertical',
        'workspace:split-horizontal',
        'workspace:toggle-pin',
        'workspace:copy-path',
        'workspace:copy-url',
        'workspace:open-in-new-window',
      ];

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];
        expect(coreWorkspaceCommands).not.toContain(commandConfig.id);
      });
    });

    it('should not conflict with core file commands', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // Core file commands
      const coreFileCommands = [
        'file-explorer:new-file',
        'file-explorer:new-folder',
        'file-explorer:move-file',
        'file-explorer:duplicate-file',
        'file-explorer:delete-file',
        'file-explorer:rename-file',
        'file-explorer:reveal-active-file',
      ];

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];
        expect(coreFileCommands).not.toContain(commandConfig.id);
      });
    });

    it('should not conflict with core search commands', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // Core search commands
      const coreSearchCommands = [
        'global-search:open',
        'switcher:open',
        'command-palette:open',
        'quick-switcher:open',
        'search:replace-in-file',
        'search:replace-all',
      ];

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];
        expect(coreSearchCommands).not.toContain(commandConfig.id);
      });
    });
  });

  describe('Command Naming Conventions', () => {
    it('should use plugin-specific prefixes to avoid conflicts', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];

        // Should use joplin-specific naming or clear context
        const hasPluginContext =
          commandConfig.id.includes('joplin') ||
          commandConfig.name.toLowerCase().includes('joplin');

        expect(hasPluginContext).toBe(true);
      });
    });

    it('should not use generic command names that could conflict', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // Generic names that could conflict with other plugins
      const genericNames = [
        'open',
        'close',
        'save',
        'search',
        'import',
        'export',
        'settings',
        'help',
        'about',
        'refresh',
        'clear',
        'reset',
      ];

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];

        // Command ID should not be just a generic name
        expect(genericNames).not.toContain(commandConfig.id);

        // Command name should have context (not just generic)
        const nameWords = commandConfig.name.toLowerCase().split(' ');
        const hasGenericOnlyName = nameWords.length === 1 && genericNames.includes(nameWords[0]);
        expect(hasGenericOnlyName).toBe(false);
      });
    });
  });

  describe('Hotkey Conflict Prevention', () => {
    it('should not define hotkeys that conflict with common plugin hotkeys', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // Common hotkeys used by popular plugins
      const commonPluginHotkeys = [
        'Ctrl+T', 'Cmd+T',           // Often used for templates
        'Ctrl+D', 'Cmd+D',           // Often used for daily notes
        'Ctrl+W', 'Cmd+W',           // Often used for weekly notes
        'Ctrl+K', 'Cmd+K',           // Often used for quick actions
        'Ctrl+J', 'Cmd+J',           // Often used for jumping
        'Ctrl+L', 'Cmd+L',           // Often used for linking
        'Ctrl+M', 'Cmd+M',           // Often used for markdown
        'Ctrl+R', 'Cmd+R',           // Often used for refresh
        'Ctrl+E', 'Cmd+E',           // Often used for editing
        'Ctrl+G', 'Cmd+G',           // Often used for goto
      ];

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];

        // Should not have any hotkeys defined
        expect(commandConfig.hotkeys).toBeUndefined();

        // If hotkeys were somehow defined, they shouldn't conflict
        if (commandConfig.hotkeys) {
          commandConfig.hotkeys.forEach((hotkey: any) => {
            const hotkeyString = `${hotkey.modifiers?.join('+') || ''}+${hotkey.key}`;
            expect(commonPluginHotkeys).not.toContain(hotkeyString);
          });
        }
      });
    });

    it('should allow users to assign any available hotkey', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];

        // No default hotkeys means users can assign any available hotkey
        expect(commandConfig.hotkeys).toBeUndefined();

        // Command structure should support hotkey assignment
        expect(commandConfig.id).toBeDefined();
        expect(commandConfig.name).toBeDefined();
        expect(commandConfig.callback).toBeDefined();
      });
    });
  });

  describe('Plugin Load Order Independence', () => {
    it('should work regardless of when other plugins are loaded', () => {
      // Our commands should not depend on other plugins being loaded first
      const commandCalls = (plugin.addCommand as any).mock.calls;

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];

        // Commands should be self-contained
        expect(() => {
          commandConfig.callback();
        }).not.toThrow();
      });
    });

    it('should not interfere with other plugins loading after', () => {
      // Since we don't define hotkeys, we won't interfere with other plugins
      const commandCalls = (plugin.addCommand as any).mock.calls;

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];

        // No hotkeys means no interference
        expect(commandConfig.hotkeys).toBeUndefined();
      });
    });
  });
});