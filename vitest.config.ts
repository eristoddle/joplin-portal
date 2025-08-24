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
      // Ensure tests import the TypeScript source, not compiled JS
      './main': resolve(__dirname, './main.ts'),
      '../main': resolve(__dirname, './main.ts'),
      '../../main': resolve(__dirname, './main.ts'),
    },
  },
});