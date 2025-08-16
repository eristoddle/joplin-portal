import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import JoplinPortalPlugin from '../../main.js';
import { Plugin } from '../mocks/obsidian-mock';

// Mock the dependencies
vi.mock('obsidian', () => import('../mocks/obsidian-mock'));

describe('Command Functionality Without Default Hotkeys', () => {
  let plugin: JoplinPortalPlugin;
  let mockApp: any;
  let mockManifest: any;

  beforeEach(async () => {
    // Create mock app with workspace and command palette functionality
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

    // Create plugin instance
    plugin = new JoplinPortalPlugin(mockApp, mockManifest);

    // Mock the loadData method to return default settings
    plugin.loadData = vi.fn().mockResolvedValue({});

    // Load the plugin
    await plugin.onload();
  });

  afterEach(async () => {
    if (plugin) {
      await plugin.onunload();
    }
    vi.clearAllMocks();
  });

  describe('Command Registration Without Default Hotkeys', () => {
    it('should register all commands without hotkeys property', () => {
      // Verify addCommand was called for each expected command
      expect(plugin.addCommand).toHaveBeenCalledTimes(8);

      // Get all command registration calls
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // Expected commands
      const expectedCommands = [
        'open-joplin-portal',
        'check-joplin-connection',
        'clear-joplin-queue',
        'clear-joplin-cache',
        'show-joplin-cache-stats',
        'focus-joplin-search',
        'select-all-joplin-import',
        'import-selected-joplin-notes',
      ];

      // Verify each command was registered
      expectedCommands.forEach((expectedId, index) => {
        const commandConfig = commandCalls[index][0];
        expect(commandConfig.id).toBe(expectedId);
        expect(commandConfig.name).toBeDefined();
        expect(commandConfig.callback).toBeDefined();

        // CRITICAL: Verify no hotkeys property is defined
        expect(commandConfig).not.toHaveProperty('hotkeys');
        expect(commandConfig.hotkeys).toBeUndefined();
      });
    });

    it('should not define conflicting hotkeys with Obsidian core shortcuts', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // Verify no command has conflicting hotkeys
      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];

        // Should not have any of these conflicting hotkeys
        const conflictingHotkeys = [
          'Ctrl+F',    // Global search
          'Ctrl+A',    // Select all
          'Ctrl+Enter', // Various core functions
        ];

        // Since we removed hotkeys entirely, this should never be an issue
        expect(commandConfig.hotkeys).toBeUndefined();
      });
    });
  });

  describe('Command Palette Functionality', () => {
    it('should allow all commands to be invoked through command palette', async () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // Test each command can be executed
      for (const call of commandCalls) {
        const commandConfig = call[0];

        // Verify callback is a function
        expect(typeof commandConfig.callback).toBe('function');

        // Test that callback can be invoked (simulating command palette execution)
        expect(() => {
          commandConfig.callback();
        }).not.toThrow();
      }
    });

    it('should have descriptive command names for command palette', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];

        // Verify command has a meaningful name
        expect(commandConfig.name).toBeDefined();
        expect(commandConfig.name.length).toBeGreaterThan(0);
        expect(typeof commandConfig.name).toBe('string');

        // Verify name is descriptive (not just the ID)
        expect(commandConfig.name).not.toBe(commandConfig.id);
      });
    });
  });

  describe('Custom Hotkey Assignment Compatibility', () => {
    it('should allow users to assign custom hotkeys through Obsidian settings', () => {
      // Since we removed default hotkeys, users should be able to assign any hotkey
      // This test verifies the command structure supports custom hotkey assignment

      const commandCalls = (plugin.addCommand as any).mock.calls;

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];

        // Verify command has required properties for hotkey assignment
        expect(commandConfig.id).toBeDefined();
        expect(commandConfig.name).toBeDefined();
        expect(commandConfig.callback).toBeDefined();

        // Verify no default hotkeys that would prevent custom assignment
        expect(commandConfig.hotkeys).toBeUndefined();
      });
    });

    it('should not interfere with Obsidian hotkey management', () => {
      // Mock Obsidian's hotkey system
      const mockHotkeys = [
        { key: 'Ctrl+F', command: 'global-search' },
        { key: 'Ctrl+A', command: 'editor:select-all' },
        { key: 'Ctrl+Enter', command: 'editor:follow-link' },
      ];

      mockApp.keymap.getHotkeys.mockReturnValue(mockHotkeys);

      // Verify our commands don't conflict with existing hotkeys
      const commandCalls = (plugin.addCommand as any).mock.calls;

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];

        // Since we don't define hotkeys, there should be no conflicts
        expect(commandConfig.hotkeys).toBeUndefined();
      });
    });
  });

  describe('Specific Command Functionality', () => {
    it('should execute focus-joplin-search command without errors', () => {
      const focusCommand = (plugin.addCommand as any).mock.calls
        .find((call: any) => call[0].id === 'focus-joplin-search');

      expect(focusCommand).toBeDefined();

      // Should not throw when executed
      expect(() => {
        focusCommand[0].callback();
      }).not.toThrow();
    });

    it('should execute select-all-joplin-import command without errors', () => {
      const selectAllCommand = (plugin.addCommand as any).mock.calls
        .find((call: any) => call[0].id === 'select-all-joplin-import');

      expect(selectAllCommand).toBeDefined();

      // Should not throw when executed
      expect(() => {
        selectAllCommand[0].callback();
      }).not.toThrow();
    });

    it('should execute import-selected-joplin-notes command without errors', () => {
      const importCommand = (plugin.addCommand as any).mock.calls
        .find((call: any) => call[0].id === 'import-selected-joplin-notes');

      expect(importCommand).toBeDefined();

      // Should not throw when executed
      expect(() => {
        importCommand[0].callback();
      }).not.toThrow();
    });
  });

  describe('Plugin Compatibility', () => {
    it('should not register commands that conflict with common plugin patterns', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      // Common plugin command patterns that might conflict
      const commonPluginCommands = [
        'global-search',
        'quick-switcher',
        'command-palette',
        'file-explorer',
      ];

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];

        // Verify our command IDs don't conflict with common patterns
        expect(commonPluginCommands).not.toContain(commandConfig.id);
      });
    });

    it('should use plugin-specific command ID prefix', () => {
      const commandCalls = (plugin.addCommand as any).mock.calls;

      commandCalls.forEach((call: any) => {
        const commandConfig = call[0];

        // All our commands should be joplin-specific or have clear context
        const hasJoplinContext =
          commandConfig.id.includes('joplin') ||
          commandConfig.name.toLowerCase().includes('joplin');

        expect(hasJoplinContext).toBe(true);
      });
    });
  });

  describe('Command Error Handling', () => {
    it('should handle command execution gracefully when view is not open', () => {
      // Mock scenario where Joplin Portal view is not open
      mockApp.workspace.getLeavesOfType.mockReturnValue([]);

      const viewDependentCommands = [
        'focus-joplin-search',
        'select-all-joplin-import',
        'import-selected-joplin-notes',
      ];

      viewDependentCommands.forEach(commandId => {
        const command = (plugin.addCommand as any).mock.calls
          .find((call: any) => call[0].id === commandId);

        expect(command).toBeDefined();

        // Should not throw even when view is not available
        expect(() => {
          command[0].callback();
        }).not.toThrow();
      });
    });

    it('should handle command execution when services are not initialized', () => {
      // Test commands that depend on services
      const serviceCommands = [
        'check-joplin-connection',
        'clear-joplin-queue',
        'clear-joplin-cache',
        'show-joplin-cache-stats',
      ];

      serviceCommands.forEach(commandId => {
        const command = (plugin.addCommand as any).mock.calls
          .find((call: any) => call[0].id === commandId);

        expect(command).toBeDefined();

        // Should handle gracefully even if services aren't ready
        expect(() => {
          command[0].callback();
        }).not.toThrow();
      });
    });
  });
});