# Release Process

This document describes the automated release process for the Joplin Portal plugin.

## Release Scripts

The following scripts are available for automating the release process:

### 1. Version Bump (`scripts/version-bump.mjs`)

Updates version numbers across all relevant files.

```bash
# Bump patch version (1.0.0 -> 1.0.1)
npm run version:bump patch

# Bump minor version (1.0.0 -> 1.1.0)
npm run version:bump minor

# Bump major version (1.0.0 -> 2.0.0)
npm run version:bump major

# Set specific version
npm run version:bump 1.2.3
```

**What it does:**
- Updates `package.json` version
- Updates `manifest.json` version
- Updates `versions.json` with new version mapping
- Stages files for git commit
- Provides next steps guidance

### 2. Production Build (`scripts/build-release.mjs`)

Creates an optimized production build.

```bash
npm run build:release
```

**What it does:**
- Cleans previous build artifacts
- Builds with esbuild in production mode (minified, no sourcemaps)
- Copies required files to `dist/` directory
- Creates `release-info.json` with build metadata
- Shows build summary with file sizes

### 3. Release Preparation (`scripts/prepare-release.mjs`)

Prepares the final release package with validation.

```bash
npm run prepare:release
```

**What it does:**
- Validates all required files exist
- Creates versioned release directory (`releases/v{version}/`)
- Copies plugin files to release directory
- Generates SHA256 checksums for all files
- Creates release package metadata
- Creates ZIP archive (if zip command available)
- Validates plugin structure and manifest
- Provides next steps guidance

### 4. Changelog Generation (`scripts/generate-changelog.mjs`)

Generates changelog from git commits.

```bash
# Generate changelog for specific version
npm run changelog 1.2.0
```

**What it does:**
- Analyzes git commits since last tag
- Categorizes commits (features, fixes, improvements, breaking changes)
- Updates `CHANGELOG.md` with new version entry
- Creates `release-notes-{version}.md` for GitHub releases
- Lists contributors for the release

## Complete Release Workflow

Follow these steps for a complete release:

### 1. Pre-release Preparation

```bash
# Ensure all tests pass
npm test

# Ensure code is properly formatted and linted
npm run build

# Review and update documentation if needed
```

### 2. Version and Build

```bash
# Bump version (choose appropriate type)
npm run version:bump minor

# Generate changelog
npm run changelog 1.1.0

# Review generated changelog and edit if necessary
```

### 3. Create Release Package

```bash
# Build and prepare release
npm run release
```

This runs both `build:release` and `prepare:release` scripts.

### 4. Git Operations

```bash
# Commit version changes
git add .
git commit -m "chore: release v1.1.0"

# Create and push tag
git tag v1.1.0
git push origin main --tags
```

### 5. GitHub Release

1. Go to GitHub repository releases page
2. Click "Create a new release"
3. Select the version tag (v1.1.0)
4. Use content from `release-notes-1.1.0.md` as release description
5. Attach files from `releases/v1.1.0/` directory:
   - `main.js`
   - `manifest.json`
   - `styles.css` (if exists)
   - `joplin-portal-1.1.0.zip` (if created)

## File Structure

After running the release scripts, you'll have:

```
releases/
└── v1.1.0/
    ├── main.js                    # Minified plugin code
    ├── manifest.json              # Plugin manifest
    ├── styles.css                 # Plugin styles (if exists)
    ├── package.json               # Release metadata
    ├── checksums.txt              # SHA256 checksums
    ├── joplin-portal-1.1.0.zip    # Release archive
    └── joplin-portal-1.1.0.zip.sha256  # Archive checksum

CHANGELOG.md                       # Updated changelog
release-notes-1.1.0.md            # GitHub release notes
```

## Validation Checks

The release scripts perform several validation checks:

- **Required files**: Ensures `main.js` and `manifest.json` exist
- **Plugin structure**: Validates main.js exports Plugin class
- **Manifest completeness**: Checks all required manifest fields
- **Version consistency**: Ensures versions match across files
- **File integrity**: Generates checksums for verification

## Troubleshooting

### Build Fails
- Check TypeScript compilation: `npm run build`
- Ensure all dependencies are installed: `npm install`
- Check for syntax errors in source files

### Version Bump Issues
- Ensure you're in a git repository
- Check that files aren't locked or read-only
- Verify version format (semantic versioning)

### Release Preparation Fails
- Run build first: `npm run build:release`
- Check file permissions
- Ensure required files exist

### Changelog Generation Issues
- Ensure you're in a git repository with commits
- Check that git tags exist for previous versions
- Verify git log access permissions

## Manual Release (Fallback)

If automated scripts fail, you can create a release manually:

1. Update versions in `package.json`, `manifest.json`, and `versions.json`
2. Run `npm run build`
3. Copy `main.js`, `manifest.json`, and `styles.css` to a release folder
4. Create ZIP archive with these files
5. Generate checksums manually
6. Create git tag and GitHub release

## Security Considerations

- All release files include SHA256 checksums for integrity verification
- ZIP archives are also checksummed
- No sensitive information is included in release packages
- Build process excludes development dependencies and source files