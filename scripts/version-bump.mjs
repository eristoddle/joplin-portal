#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";

/**
 * Version bump script for Obsidian plugin
 * Updates package.json, manifest.json, and versions.json
 * Supports semantic versioning: major, minor, patch, or specific version
 */

const args = process.argv.slice(2);
const versionType = args[0] || 'patch'; // default to patch

// Get current version from package.json
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const currentVersion = packageJson.version;

console.log(`Current version: ${currentVersion}`);

// Calculate new version
let newVersion;
if (['major', 'minor', 'patch'].includes(versionType)) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  switch (versionType) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }
} else {
  // Assume it's a specific version
  newVersion = versionType;

  // Validate version format
  if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.error('Invalid version format. Use semantic versioning (e.g., 1.2.3) or bump type (major, minor, patch)');
    process.exit(1);
  }
}

console.log(`New version: ${newVersion}`);

// Update package.json
packageJson.version = newVersion;
writeFileSync("package.json", JSON.stringify(packageJson, null, 2));
console.log('✓ Updated package.json');

// Update manifest.json
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = newVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));
console.log('✓ Updated manifest.json');

// Update versions.json
let versions = {};
if (existsSync("versions.json")) {
  versions = JSON.parse(readFileSync("versions.json", "utf8"));
}
versions[newVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));
console.log('✓ Updated versions.json');

// Create git tag if in git repository
try {
  execSync('git rev-parse --git-dir', { stdio: 'ignore' });

  // Stage the changed files
  execSync('git add package.json manifest.json versions.json');
  console.log('✓ Staged version files for git');

  console.log(`\nVersion bump complete! New version: ${newVersion}`);
  console.log('Next steps:');
  console.log('1. Review the changes');
  console.log('2. Commit: git commit -m "chore: bump version to ' + newVersion + '"');
  console.log('3. Tag: git tag v' + newVersion);
  console.log('4. Push: git push && git push --tags');

} catch (error) {
  console.log('✓ Version files updated (not in git repository)');
}