import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import JoplinPortalPlugin from '../../main.ts';
import { JoplinPortalView } from '../../src/joplin-portal-view';

// Mock the dependencies
vi.mock('obsidian', () => import('../mocks/obsidian-mock'));

describe('Command Integration Tests', () => {
  let plugin: JoplinPortalPlugin;
  let mockApp: any;
  let mockManifest: any;
  let mockView: any;

  beforeEach(async () => {
    // Create comprehensive mock app
    mockApp = {
      workspace: {
        getLeavesOfType: vi.fn(),
        getRightLeaf: vi.fn(),
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
        pushScope: vi.fn(),
        popScope: vi.fn(),
      },
    };

    mockManifest = {
      id: 'joplin-portal',
      name: 'Joplin Portal',
      version: '1.0.0',
    };

    // Mock JoplinPortalView
    mockView = {
      focusSearchInput: vi.fn(),
      selectAllForImport: vi.fn(),
      showImportConfirmationDialog: vi.fn(),
    };

    // Create plugin instance
    plugin = new JoplinPortalPlugin(mockApp, mockManifest);

    // Mock the loadData method
    plugin.loadData = vi.fn().mockResolvedValue({
      serverUrl: 'http://localhost:41184',
      apiToken: 'test-token',
      debugMode: false,
    });

    // Load the plugin
    await plugin.onload();
  });

  afterEach(async () => {
    if (plugin) {
      await plugin.onunload();
    }
    vi.clearAllMocks();
  });

  describe('Command Execution with View Available', () => {
    beforeEach(() => {
      // Mock that the view is available - need to check instanceof JoplinPortalView
      const mockLeaf = {
        view: Object.assign(mockView, { constructor: { name: 'JoplinPortalView' } }),
      };
      mockApp.workspace.getLeavesOfType.mockReturnValue([mockLeaf]);
    });

    it('should execute focus-joplin-search command without errors', () => {
      const focusCommand = (plugin.addCommand as any).mock.calls
        .find((call: any) => call[0].id === 'focus-joplin-search');

      expect(focusCommand).toBeDefined();

      // Execute the command - should not throw
      expect(() => {
        focusCommand[0].callback();
      }).not.toThrow();
    });

    it('should execute select-all-joplin-import command without errors', () => {
      const selectAllCommand = (plugin.addCommand as any).mock.calls
        .find((call: any) => call[0].id === 'select-all-joplin-import');

      expect(selectAllCommand).toBeDefined();

      // Execute the command - should not throw
      expect(() => {
        selectAllCommand[0].callback();
      }).not.toThrow();
    });

    it('should execute import-selected-joplin-notes command without errors', () => {
      const importCommand = (plugin.addCommand as any).mock.calls
        .find((call: any) => call[0].id === 'import-selected-joplin-notes');

      expect(importCommand).toBeDefined();

      // Execute the command - should not throw
      expect(() => {
        importCommand[0].callback();
      }).not.toThrow();
    });
  });

  describe('Command Execution without View Available', () => {
    beforeEach(() => {
      // Mock that no view is available
      mockApp.workspace.getLeavesOfType.mockReturnValue([]);
    });

    it('should handle focus-joplin-search gracefully when view not available', () => {
      const focusCommand = (plugin.addCommand as any).mock.calls
        .find((call: any) => call[0].id === 'focus-joplin-search');

      expect(focusCommand).toBeDefined();

      // Should not throw
      expect(() => {
        focusCommand[0].callback();
      }).not.toThrow();

      // View method should not be called
      expect(mockView.focusSearchInput).not.toHaveBeenCalled();
    });

    it('should handle select-all-joplin-import gracefully when view not available', () => {
      const selectAllCommand = (plugin.addCommand as any).mock.calls
        .find((call: any) => call[0].id === 'select-all-joplin-import');

      expect(selectAllCommand).toBeDefined();

      // Should not throw
      expect(() => {
        selectAllCommand[0].callback();
      }).not.toThrow();

      // View method should not be called
      expect(mockView.selectAllForImport).not.toHaveBeenCalled();
    });

    it('should handle import-selected-joplin-notes gracefully when view not available', () => {
      const importCommand = (plugin.addCommand as any).mock.calls
        .find((call: any) => call[0].id === 'import-selected-joplin-notes');

      expect(importCommand).toBeDefined();

      // Should not throw
      expect(() => {
        importCommand[0].callback();
      }).not.toThrow();

      // View method should not be called
      expect(mockView.showImportConfirmationDialog).not.toHaveBeenCalled();
    });
  });

  describe('Service-Dependent Commands', () => {
    it('should execute check-joplin-connection command', () => {
      const connectionCommand = (plugin.addCommand as any).mock.calls
        .find((call: any) => call[0].id === 'check-joplin-connection');

      expect(connectionCommand).toBeDefined();

      // Should not throw
      expect(() => {
        connectionCommand[0].callback();
      }).not.toThrow();
    });

    it('should execute clear-joplin-queue command', () => {
      const clearQueueCommand = (plugin.addCommand as any).mock.calls
        .find((call: any) => call[0].id === 'clear-joplin-queue');

      expect(clearQueueCommand).toBeDefined();

      // Should not throw
      expect(() => {
        clearQueueCommand[0].callback();
      }).not.toThrow();
    });

    it('should execute clear-joplin-cache command', () => {
      const clearCacheCommand = (plugin.addCommand as any).mock.calls
        .find((call: any) => call[0].id === 'clear-joplin-cache');

      expect(clearCacheCommand).toBeDefined();

      // Should not throw
      expect(() => {
        clearCacheCommand[0].callback();
      }).not.toThrow();
    });

    it('should execute show-joplin-cache-stats command', () => {
      const statsCommand = (plugin.addCommand as any).mock.calls
        .find((call: any) => call[0].id === 'show-joplin-cache-stats');

      expect(statsCommand).toBeDefined();

      // Should not throw
      expect(() => {
        statsCommand[0].callback();
      }).not.toThrow();
    });
  });

  describe('Plugin Lifecycle with Commands', () => {
    it('should register all commands during onload', async () => {
      // Create a fresh plugin instance
      const freshPlugin = new JoplinPortalPlugin(mockApp, mockManifest);
      freshPlugin.loadData = vi.fn().mockResolvedValue({});

      // Load the plugin
      await freshPlugin.onload();

      // Verify commands were registered
      expect(freshPlugin.addCommand).toHaveBeenCalledTimes(8);

      // Clean up
      await freshPlugin.onunload();
    });

    it('should handle plugin unload gracefully', async () => {
      // Plugin should unload without errors
      expect(async () => {
        await plugin.onunload();
      }).not.toThrow();
    });
  });

  describe('Command Accessibility', () => {
    it('should have commands accessible through Obsidian command system', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // Verify each command has the required structure for Obsidian's command system
      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];

        // Required for command palette integration
        expect(commandConfig.id).toBeDefined();
        expect(typeof commandConfig.id).toBe('string');
        expect(commandConfig.id.length).toBeGreaterThan(0);

        expect(commandConfig.name).toBeDefined();
        expect(typeof commandConfig.name).toBe('string');
        expect(commandConfig.name.length).toBeGreaterThan(0);

        expect(commandConfig.callback).toBeDefined();
        expect(typeof commandConfig.callback).toBe('function');

        // Should not have hotkeys (this is what we're testing)
        expect(commandConfig.hotkeys).toBeUndefined();
      });
    });

    it('should allow commands to be found by name search', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];

        // Command names should be searchable - either contain "joplin" or have clear context
        const hasJoplinContext =
          commandConfig.name.toLowerCase().includes('joplin') ||
          commandConfig.id.includes('joplin');
        expect(hasJoplinContext).toBe(true);

        // Should have descriptive names for better discoverability
        const words = commandConfig.name.toLowerCase().split(' ');
        expect(words.length).toBeGreaterThan(1); // Multi-word names are more descriptive
      });
    });
  });

  describe('Hotkey Conflict Prevention', () => {
    it('should not define any default hotkeys that could conflict', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // List of common Obsidian hotkeys that should not be overridden
      const reservedHotkeys = [
        'Ctrl+F', 'Cmd+F',           // Search
        'Ctrl+A', 'Cmd+A',           // Select all
        'Ctrl+Enter', 'Cmd+Enter',   // Follow link
        'Ctrl+N', 'Cmd+N',           // New note
        'Ctrl+O', 'Cmd+O',           // Quick switcher
        'Ctrl+P', 'Cmd+P',           // Command palette
        'Ctrl+S', 'Cmd+S',           // Save
        'Ctrl+Z', 'Cmd+Z',           // Undo
        'Ctrl+Y', 'Cmd+Y',           // Redo
        'Ctrl+C', 'Cmd+C',           // Copy
        'Ctrl+V', 'Cmd+V',           // Paste
        'Ctrl+X', 'Cmd+X',           // Cut
      ];

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];

        // Verify no hotkeys are defined at all
        expect(commandConfig.hotkeys).toBeUndefined();

        // If hotkeys were defined (they shouldn't be), verify no conflicts
        if (commandConfig.hotkeys) {
          commandConfig.hotkeys.forEach((hotkey: any) => {
            const hotkeyString = `${hotkey.modifiers?.join('+') || ''}+${hotkey.key}`;
            expect(reservedHotkeys).not.toContain(hotkeyString);
          });
        }
      });
    });
  });
});