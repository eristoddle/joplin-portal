# Simple Release Process

This project now has a unified release script that handles everything automatically!

## Quick Release

Just run one command and everything happens:

```bash
# Patch release (1.0.0 → 1.0.1)
npm run release

# Minor release (1.0.0 → 1.1.0)
npm run release:minor

# Major release (1.0.0 → 2.0.0)
npm run release:major

# Fully automated (no prompts)
npm run release:auto
```

## What It Does Automatically

The unified release script handles:

1. **Pre-flight checks** - Verifies git status and repository state
2. **Tests** - Runs your test suite (with confirmation)
3. **Version bump** - Updates package.json, manifest.json, and versions.json
4. **Changelog** - Generates changelog from git commits (with confirmation)
5. **Build** - Creates optimized production build
6. **Package** - Prepares release files with checksums
7. **Git operations** - Commits, tags, and pushes (with confirmation)
8. **GitHub release** - Creates GitHub release with files (optional, requires gh CLI)

## Options

- `--yes` or `-y` - Skip all confirmations (fully automated)
- Version types: `patch`, `minor`, `major`, or specific version like `1.2.3`

## Examples

```bash
# Interactive patch release
npm run release

# Automated minor release
npm run release:minor -- --yes

# Specific version
npm run release 2.1.0

# Fully automated patch release
npm run release:auto
```

## Requirements

- Git repository with remote
- Node.js and npm
- Optional: GitHub CLI (`gh`) for automatic GitHub releases

## Fallback

If you need the old manual process, the individual scripts are still available:

```bash
npm run release:legacy  # Old build + prepare process
npm run version:bump    # Just version bump
npm run changelog       # Just changelog
```

That's it! One command does everything. 🚀