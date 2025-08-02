# GitHub Actions Workflows

This directory contains the CI/CD workflows for the Joplin Portal plugin.

## Workflows

### 1. Test (`test.yml`)
**Trigger:** Pull requests and pushes to main/develop branches
**Purpose:** Run automated tests on multiple Node.js versions

- Runs on Node.js 18.x and 20.x
- Executes TypeScript type checking
- Runs the full test suite
- Uploads test results as artifacts

### 2. Build and Validate (`build.yml`)
**Trigger:** Pull requests and pushes to main/develop branches
**Purpose:** Build the plugin and validate the output

- Builds the plugin using the production build script
- Validates manifest.json structure and required fields
- Checks built file sizes and warns if too large
- Uploads build artifacts for inspection

### 3. Code Quality (`quality.yml`)
**Trigger:** Pull requests and pushes to main/develop branches
**Purpose:** Perform code quality checks and security audits

- Checks code style and common issues
- Runs security audit on dependencies
- Validates TypeScript configuration
- Checks for sensitive data patterns
- Monitors bundle size

### 4. Release (`release.yml`)
**Trigger:** Version tags (v*)
**Purpose:** Create automated releases with plugin assets

- Validates tag version matches manifest version
- Runs full test suite before release
- Creates release archive with all plugin files
- Generates changelog from git commits
- Creates GitHub release with comprehensive documentation
- Uploads individual plugin files and checksums

### 5. Maintenance (`maintenance.yml`)
**Trigger:** Weekly schedule (Sundays 2 AM UTC) or manual
**Purpose:** Automated maintenance tasks

- Checks for outdated dependencies
- Creates issues for dependency updates
- Tests compatibility with different Obsidian versions

## Release Process

To create a new release:

1. Update the version in `manifest.json` and `package.json`
2. Commit the version changes
3. Create and push a version tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
4. The release workflow will automatically:
   - Run tests
   - Build the plugin
   - Create a GitHub release
   - Upload plugin assets

## Security

- All workflows use pinned action versions for security
- Sensitive operations require appropriate permissions
- Security audits are run regularly
- No secrets are exposed in logs

## Artifacts

- **Test Results**: Stored for 30 days
- **Build Artifacts**: Stored for 7 days
- **Release Assets**: Permanent (part of GitHub releases)

## Troubleshooting

### Failed Tests
- Check the test workflow logs
- Ensure all dependencies are properly installed
- Verify TypeScript compilation passes

### Failed Builds
- Check that all required files are present
- Verify manifest.json is valid
- Ensure build scripts complete successfully

### Failed Releases
- Verify tag version matches manifest version
- Ensure all tests pass
- Check that required files are built correctly

### Dependency Issues
- Review weekly maintenance reports
- Update outdated dependencies as needed
- Address security vulnerabilities promptly