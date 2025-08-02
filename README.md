# Joplin Portal

An Obsidian plugin that provides seamless access to Joplin notes through a dedicated sidebar panel.

## Features

- Search Joplin notes from within Obsidian
- Preview note content without leaving Obsidian
- Selectively import notes from Joplin to Obsidian
- Seamless integration with Obsidian's UI

## Development

### Prerequisites

- Node.js (v16 or higher)
- npm

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the plugin: `npm run build`
4. For development with hot reload: `npm run dev`

### Project Structure

```
├── main.ts                 # Main plugin entry point
├── src/
│   └── types.ts           # Core TypeScript interfaces
├── manifest.json          # Plugin manifest
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript configuration
├── esbuild.config.mjs     # Build configuration
└── version-bump.mjs       # Version management utility
```

## Installation

This plugin is currently in development. Once complete, it will be available through the Obsidian Community Plugins directory.

## License

MIT