import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': './src',
      'obsidian': resolve(__dirname, './tests/mocks/obsidian-mock.ts'),
    },
  },
});