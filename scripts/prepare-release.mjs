#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "fs";
import { execSync } from "child_process";
import { createHash } from "crypto";

/**
 * Release preparation script for Obsidian plugin
 * Validates plugin files, creates release package, and generates checksums
 */

console.log('📦 Preparing release package...');

// Read manifest to get version and plugin info
if (!existsSync('manifest.json')) {
  console.error('❌ manifest.json not found');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const version = manifest.version;
const pluginId = manifest.id;

console.log(`Plugin: ${manifest.name} (${pluginId})`);
console.log(`Version: ${version}`);

// Validate required files exist
const requiredFiles = ['main.js', 'manifest.json'];
const optionalFiles = ['styles.css'];
const missingRequired = requiredFiles.filter(file => !existsSync(file));

if (missingRequired.length > 0) {
  console.error('❌ Missing required files:', missingRequired.join(', '));
  console.error('Run the build script first: npm run build');
  process.exit(1);
}

// Create release directory
const releaseDir = `releases/${version}`;
if (!existsSync('releases')) {
  mkdirSync('releases');
}
if (!existsSync(releaseDir)) {
  mkdirSync(releaseDir, { recursive: true });
}

console.log(`📁 Created release directory: ${releaseDir}`);

// Copy files and generate checksums
const releaseFiles = [];
const checksums = {};

[...requiredFiles, ...optionalFiles].forEach(file => {
  if (existsSync(file)) {
    const destPath = `${releaseDir}/${file}`;
    copyFileSync(file, destPath);

    // Generate checksum
    const content = readFileSync(file);
    const hash = createHash('sha256').update(content).digest('hex');
    checksums[file] = hash;

    releaseFiles.push(file);
    console.log(`✓ Copied ${file} (${(content.length / 1024).toFixed(2)} KB)`);
  }
});

// Create release package info
const releasePackage = {
  pluginId: pluginId,
  name: manifest.name,
  version: version,
  description: manifest.description,
  author: manifest.author,
  minAppVersion: manifest.minAppVersion,
  releaseDate: new Date().toISOString(),
  files: releaseFiles,
  checksums: checksums
};

writeFileSync(`${releaseDir}/package.json`, JSON.stringify(releasePackage, null, 2));
console.log('✓ Created package.json');

// Create checksums file
const checksumContent = Object.entries(checksums)
  .map(([file, hash]) => `${hash}  ${file}`)
  .join('\n');
writeFileSync(`${releaseDir}/checksums.txt`, checksumContent);
console.log('✓ Created checksums.txt');

// Create zip archive if zip command is available
try {
  execSync('which zip', { stdio: 'ignore' });

  const zipName = `${pluginId}-${version}.zip`;
  const zipPath = `${releaseDir}/${zipName}`;

  // Create zip with required files
  const filesToZip = releaseFiles.join(' ');
  execSync(`zip -j "${zipPath}" ${filesToZip}`, { stdio: 'inherit' });

  // Generate zip checksum
  const zipContent = readFileSync(zipPath);
  const zipHash = createHash('sha256').update(zipContent).digest('hex');

  writeFileSync(`${releaseDir}/${zipName}.sha256`, `${zipHash}  ${zipName}`);
  console.log(`✓ Created ${zipName} (${(zipContent.length / 1024).toFixed(2)} KB)`);

} catch (error) {
  console.log('⚠️  Zip command not available, skipping archive creation');
}

// Validate plugin structure
console.log('\n🔍 Validating plugin structure...');

// Check main.js exports
try {
  const mainContent = readFileSync('main.js', 'utf8');
  if (!mainContent.includes('Plugin')) {
    console.warn('⚠️  Warning: main.js may not export a Plugin class');
  } else {
    console.log('✓ main.js appears to export Plugin class');
  }
} catch (error) {
  console.warn('⚠️  Could not validate main.js content');
}

// Check manifest structure
const requiredManifestFields = ['id', 'name', 'version', 'minAppVersion', 'description'];
const missingFields = requiredManifestFields.filter(field => !manifest[field]);

if (missingFields.length > 0) {
  console.warn('⚠️  Warning: Missing manifest fields:', missingFields.join(', '));
} else {
  console.log('✓ manifest.json has all required fields');
}

// Check version consistency
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
if (packageJson.version !== manifest.version) {
  console.warn('⚠️  Warning: Version mismatch between package.json and manifest.json');
} else {
  console.log('✓ Version consistent across files');
}

console.log(`\n🎉 Release package prepared successfully!`);
console.log(`   Location: ${releaseDir}/`);
console.log(`   Files: ${releaseFiles.join(', ')}`);
console.log('\nNext steps:');
console.log('1. Test the plugin in Obsidian');
console.log('2. Create git tag: git tag ' + version);
console.log('3. Push to repository: git push --tags');
console.log('4. Create GitHub release with files from ' + releaseDir);