import { vi } from 'vitest';

// Mock Obsidian API
global.window = global.window || {};

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
};