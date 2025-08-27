#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import readline from "readline";

/**
 * Unified release script for Obsidian plugin
 * Handles the complete release process from version bump to GitHub release
 */

const args = process.argv.slice(2);
const versionType = args[0] || 'patch';
const skipConfirmation = args.includes('--yes') || args.includes('-y');

console.log('🚀 Starting unified release process...');
console.log(`Version bump type: ${versionType}`);

// Function to run command and handle errors
function runCommand(command, description, options = {}) {
  console.log(`\n📋 ${description}...`);
  try {
    const result = execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      ...options
    });
    console.log(`✅ ${description} completed`);
    return result;
  } catch (error) {
    console.error(`❌ ${description} failed`);
    if (options.silent) {
      console.error(error.stdout || error.message);
    }
    process.exit(1);
  }
}

// Function to get user confirmation
function getUserConfirmation(message) {
  if (skipConfirmation) return Promise.resolve(true);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  try {
    // Pre-flight checks
    console.log('\n🔍 Pre-flight checks...');

    // Check if we're in a git repository
    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    } catch (error) {
      console.error('❌ Not in a git repository');
      process.exit(1);
    }

    // Check for uncommitted changes
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        console.log('⚠️  You have uncommitted changes:');
        console.log(status);
        const proceed = await getUserConfirmation('Continue with uncommitted changes?');
        if (!proceed) {
          console.log('Release cancelled. Please commit or stash your changes.');
          process.exit(0);
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not check git status');
    }

    // Step 1: Run tests
    console.log('\n🧪 Step 1: Running tests...');
    const runTests = skipConfirmation || await getUserConfirmation('Run tests before release?');
    if (runTests) {
      runCommand('npm test', 'Running test suite');
    }

    // Step 2: Version bump
    console.log('\n📈 Step 2: Version bump...');
    runCommand(`node scripts/version-bump.mjs ${versionType}`, 'Bumping version');

    // Get new version
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
    const newVersion = manifest.version;
    console.log(`\n🎯 New version: ${newVersion}`);

    // Step 3: Generate changelog
    console.log('\n📝 Step 3: Generating changelog...');
    const generateChangelog = skipConfirmation || await getUserConfirmation('Generate changelog from git commits?');
    if (generateChangelog) {
      runCommand(`node scripts/generate-changelog.mjs ${newVersion}`, 'Generating changelog');

      if (!skipConfirmation) {
        console.log('\n📖 Please review the generated changelog and make any necessary edits.');
        const continueAfterChangelog = await getUserConfirmation('Continue with release?');
        if (!continueAfterChangelog) {
          console.log('Release cancelled. You can resume later.');
          process.exit(0);
        }
      }
    }

    // Step 4: Build and prepare release
    console.log('\n🔨 Step 4: Building release...');
    runCommand('node scripts/build-release.mjs', 'Building production version');
    runCommand('node scripts/prepare-release.mjs', 'Preparing release package');

    // Step 5: Git operations
    console.log('\n📦 Step 5: Git operations...');
    const commitAndTag = skipConfirmation || await getUserConfirmation('Commit changes and create git tag?');
    if (commitAndTag) {
      runCommand('git add .', 'Staging changes');
      runCommand(`git commit -m "chore: release ${newVersion}"`, 'Committing changes');
      runCommand(`git tag ${newVersion}`, 'Creating git tag');

      const pushChanges = skipConfirmation || await getUserConfirmation('Push changes and tags to remote?');
      if (pushChanges) {
        runCommand('git push origin main', 'Pushing changes');
        runCommand('git push --tags', 'Pushing tags');
      }
    }

    // Step 6: Create GitHub release (optional)
    console.log('\n🐙 Step 6: GitHub release...');
    const createGitHubRelease = !skipConfirmation && await getUserConfirmation('Create GitHub release automatically? (requires gh CLI)');

    if (createGitHubRelease) {
      try {
        // Check if gh CLI is available
        execSync('which gh', { stdio: 'ignore' });

        // Check if user is authenticated
        execSync('gh auth status', { stdio: 'ignore' });

        // Create release
        const releaseNotesFile = `release-notes-${newVersion}.md`;
        const releaseDir = `releases/${newVersion}`;

        let releaseCommand = `gh release create ${newVersion} --title "${newVersion}"`;

        if (existsSync(releaseNotesFile)) {
          releaseCommand += ` --notes-file "${releaseNotesFile}"`;
        } else {
          releaseCommand += ` --notes "Release ${newVersion}"`;
        }

        // Add release files
        if (existsSync(releaseDir)) {
          const files = ['main.js', 'manifest.json', 'styles.css'].map(f => `${releaseDir}/${f}`);
          const existingFiles = files.filter(f => existsSync(f));
          if (existingFiles.length > 0) {
            releaseCommand += ` ${existingFiles.join(' ')}`;
          }

          // Add zip if it exists
          const zipFile = `${releaseDir}/joplin-portal-${newVersion}.zip`;
          if (existsSync(zipFile)) {
            releaseCommand += ` "${zipFile}"`;
          }
        }

        runCommand(releaseCommand, 'Creating GitHub release');

      } catch (error) {
        console.log('⚠️  GitHub CLI not available or not authenticated');
        console.log('You can create the release manually on GitHub');
      }
    }

    // Step 7: Final summary
    console.log('\n🎉 Release process completed successfully!');
    console.log(`\n📋 Release Summary:`);
    console.log(`   Version: ${newVersion}`);
    console.log(`   Tag: ${newVersion}`);
    console.log(`   Release files: releases/${newVersion}/`);

    if (existsSync(`release-notes-${newVersion}.md`)) {
      console.log(`   Release notes: release-notes-${newVersion}.md`);
    }

    if (!createGitHubRelease) {
      console.log(`\n📋 Manual steps remaining:`);
      console.log(`1. Go to GitHub repository releases page`);
      console.log(`2. Create new release for tag ${newVersion}`);
      if (existsSync(`release-notes-${newVersion}.md`)) {
        console.log(`3. Use content from release-notes-${newVersion}.md as description`);
      }
      console.log(`4. Attach files from releases/${newVersion}/ directory`);
      console.log(`5. Publish the release`);
    }

    console.log(`\n🚀 Release ${newVersion} is ready!`);

  } catch (error) {
    console.error('\n❌ Release process failed:', error.message);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Release process interrupted');
  process.exit(1);
});

main();